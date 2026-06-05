/**
 * Frontend catch-up sync engine (Sprint 4 + 5).
 *
 * Implements the "2-mode" model from `plan/DONG_BO_EVENT_SYNC.md`:
 *   - LIVE: socket events apply directly + advance the cursor
 *     (`lastEventSeq`) — handled in `socketChatEventGlobal.tsx`.
 *   - CATCH-UP: on boot / reconnect, pull the per-user change feed from
 *     `GET /chat/sync/events?sinceSeq=<cursor>` and apply the delta into
 *     IndexedDB + the Zustand stores, advancing the cursor in the same
 *     Dexie transaction (atomic — cursor never runs ahead of applied
 *     state).
 *
 * A single per-user cursor (`sync_meta.lastEventSeq`) unifies both
 * paths. `seq`/`nextSeq`/`currentSeq` arrive from the backend as proto
 * int64 — possibly STRINGS — so everything is `Number()`-ed at the
 * boundary. `payloadJson` is a JSON string — parsed per event.
 *
 * Reducers are idempotent: every mutation is keyed by entity id and
 * goes through an upsert, so re-applying the same `seq` (Kafka
 * re-delivery, socket+outbox double-delivery) never duplicates.
 */

import apiService from "@/service/api.service";
import { db, getMeta, setMeta } from "@/libs/db";
import useRoomStore from "@/store/useRoomStore";
import useMessageStore from "@/store/useMessageStore";
import { roomType } from "@/store/types/room.state";
import { MessageType } from "@/store/types/message.state";

/**
 * Feature flag (re-export from `syncConfig` để tránh vòng import). `false` →
 * `runCatchupSync()` luôn fallback luồng full-load cũ (`coldStart`) và mọi điểm
 * tích hợp giữ hành vi cũ.
 */
import { SYNC_ENGINE_ENABLED } from "./syncConfig";
export { SYNC_ENGINE_ENABLED };

/** Keys used in the `sync_meta` key/value table. */
export const SyncMetaKey = {
  LAST_EVENT_SEQ: "lastEventSeq",
  LAST_SYNC_AT: "lastSyncAt",
} as const;

/**
 * Change-event types emitted by the backend outbox. Mirrors
 * `ChangeEventType` on the BE. Use the enum, never bare string literals
 * (rule: enums-for-literal-values).
 */
export enum ChangeEventType {
  ROOM_NEWMSGS = "room.newmsgs",
  MESSAGE_UPDATED = "message.updated",
  MESSAGE_HIDDEN = "message.hidden",
  ROOM_READ = "room.read",
  ROOM_UPSERTED = "room.upserted",
  ROOM_REMOVED = "room.removed",
}

/** A single raw event row as returned by `GET /chat/sync/events`. */
export interface SyncEventRaw {
  seq: number | string;
  type: string;
  roomId: string; // room Mongo _id
  payloadJson: string; // JSON-encoded payload
  createdAt: string; // ISO
}

/** Response shape of `GET /chat/sync/events`. */
export interface SyncEventsResponse {
  events: SyncEventRaw[];
  nextSeq: number | string;
  hasMore: boolean;
  requireFullResync: boolean;
  currentSeq: number | string;
}

const SYNC_EVENTS_URL = "/chat/sync/events";
const PULL_LIMIT = 200;
/** Sentinel "very large" sinceSeq to fetch only the current cursor. */
const COLD_CURSOR_PROBE_SINCE = Number.MAX_SAFE_INTEGER;

// In-memory guard so overlapping triggers (boot + socket reconnect
// firing near-simultaneously) don't run two pull loops at once.
let syncInFlight: Promise<void> | null = null;

// ── Multi-tab leader election (Phần 5c) ─────────────────────────────
// Nhiều tab cùng user chia sẻ MỘT IndexedDB. Nếu mỗi tab tự pull catch-up →
// trùng request + đua ghi. Dùng Web Locks: chỉ MỘT tab giữ được lock
// "chat-catchup-sync" tại một thời điểm thực sự pull; tab khác bỏ qua vòng đó.
// Sau khi leader apply xong, broadcast để các tab còn lại refresh sidebar từ
// IndexedDB (read-only) mà khỏi pull lại.
const CATCHUP_LOCK = "chat-catchup-sync";
const SYNC_CHANNEL = "chat-sync";
const crossTabChannel =
  typeof window !== "undefined" && typeof BroadcastChannel !== "undefined"
    ? new BroadcastChannel(SYNC_CHANNEL)
    : null;
let crossTabListenerStarted = false;

/**
 * Chạy `fn` dưới Web Lock độc quyền giữa các tab. Nếu trình duyệt không hỗ trợ
 * Web Locks → chạy thẳng (fallback an toàn, chấp nhận trùng pull). Nếu tab khác
 * đang giữ lock (`ifAvailable` → `lock===null`) → bỏ qua vòng này.
 */
async function withCatchupLock(fn: () => Promise<void>): Promise<void> {
  const locks =
    typeof navigator !== "undefined"
      ? (navigator as Navigator).locks
      : undefined;
  if (!locks?.request) {
    await fn();
    return;
  }
  await locks.request(CATCHUP_LOCK, { ifAvailable: true }, async (lock) => {
    if (!lock) return; // tab khác đang là leader → để nó pull + broadcast
    await fn();
  });
}

/** Báo các tab khác: vừa apply catch-up vào IndexedDB → hãy refresh từ cache. */
function notifyOtherTabsSynced(): void {
  try {
    crossTabChannel?.postMessage({ t: "synced" });
  } catch {
    /* non-fatal */
  }
}

/**
 * Đăng ký listener cross-tab (gọi 1 lần lúc boot). Khi tab leader broadcast
 * "synced", tab này refresh danh sách phòng từ IndexedDB (read-only, không gọi
 * mạng) để phản ánh delta mà leader vừa ghi. Chat đang mở vẫn được socket live
 * cập nhật như thường.
 */
export function startCrossTabSync(): void {
  if (crossTabListenerStarted || !crossTabChannel) return;
  crossTabListenerStarted = true;
  crossTabChannel.onmessage = (ev: MessageEvent) => {
    if ((ev.data as { t?: string })?.t === "synced") {
      void useRoomStore.getState().getRoomsByType("all");
    }
  };
}

/** Coerce a possibly-string proto int64 to a JS number. */
function toNum(v: number | string | null | undefined): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Unwrap an axios response into the actual `SyncEventsResponse`. The
 * gateway may wrap the gRPC output in `{ metadata }` (the convention
 * the rest of `/chat/*` uses) or return it flat — handle both.
 */
function unwrapSyncResponse(raw: unknown): SyncEventsResponse {
  const body = (raw as { data?: unknown })?.data ?? raw;
  const inner =
    (body as { metadata?: unknown })?.metadata !== undefined
      ? (body as { metadata: unknown }).metadata
      : body;
  return inner as SyncEventsResponse;
}

async function fetchEvents(
  sinceSeq: number,
  limit: number,
): Promise<SyncEventsResponse> {
  const res = await apiService.get<unknown>(SYNC_EVENTS_URL, {
    sinceSeq,
    limit,
  });
  return unwrapSyncResponse(res);
}

/**
 * Entry point. Reads the cursor and either cold-starts (first login /
 * cursor absent / feature disabled) or runs the warm catch-up pull
 * loop. Idempotent and re-entrant-safe (overlapping calls share one
 * in-flight run).
 */
export async function runCatchupSync(): Promise<void> {
  if (syncInFlight) return syncInFlight;
  syncInFlight = (async () => {
    try {
      // Web Lock: chỉ MỘT tab thực sự pull; tab khác bỏ qua (nhận refresh qua
      // broadcast). Fallback chạy thẳng khi trình duyệt không hỗ trợ Web Locks.
      await withCatchupLock(pullCatchupLoop);
    } catch (err) {
      // Never throw out of the engine — a failed sync must not break boot.
      // The cursor is only advanced on successful batches, so the next trigger
      // (reconnect) safely resumes.
      console.error("[syncEngine] runCatchupSync failed:", err);
    } finally {
      syncInFlight = null;
    }
  })();
  return syncInFlight;
}

/**
 * The catch-up pull loop. Runs UNDER the cross-tab Web Lock (one tab at a
 * time). Cold-starts when the cursor is absent / a full resync is required;
 * otherwise pulls deltas until `hasMore=false`, advancing the cursor in the
 * same Dexie transaction as the apply.
 */
async function pullCatchupLoop(): Promise<void> {
  if (!SYNC_ENGINE_ENABLED) {
    await coldStart();
    return;
  }

  const seq = await getMeta<number>(SyncMetaKey.LAST_EVENT_SEQ);
  if (seq == null) {
    await coldStart();
    return;
  }

  let cursor = toNum(seq);
  // Bounded loop — guards against a server that never sets hasMore=false.
  for (let guard = 0; guard < 10_000; guard++) {
    const res = await fetchEvents(cursor, PULL_LIMIT);

    if (res?.requireFullResync) {
      await coldStart();
      return;
    }

    // Self-heal con trỏ bị "đầu độc": cursor vượt seq hiện tại của server (vd
    // lastEventSeq = MAX_SAFE_INTEGER do bug currentSeq cũ) → pull rỗng vĩnh
    // viễn. Realign về currentSeq để lần sau pull bình thường.
    const serverSeq = toNum(res?.currentSeq);
    if (serverSeq > 0 && cursor > serverSeq) {
      await setMeta(SyncMetaKey.LAST_EVENT_SEQ, serverSeq);
      await setMeta(SyncMetaKey.LAST_SYNC_AT, Date.now());
      break;
    }

    const events = Array.isArray(res?.events) ? res.events : [];
    const nextSeq = toNum(res?.nextSeq);

    // Apply the whole batch + advance the cursor in ONE Dexie transaction. If
    // any reducer throws, Dexie rolls back and the cursor is NOT advanced → the
    // batch is retried next run.
    await db.transaction(
      "rw",
      [db.rooms, db.messages, db.sync_meta],
      async () => {
        for (const ev of events) {
          await applyEvent(ev);
        }
        await setMeta(SyncMetaKey.LAST_EVENT_SEQ, Math.max(cursor, nextSeq));
      },
    );

    cursor = Math.max(cursor, nextSeq);
    await setMeta(SyncMetaKey.LAST_SYNC_AT, Date.now());

    // Các tab khác (cùng user) refresh sidebar từ IndexedDB sau khi ta ghi delta.
    if (events.length > 0) notifyOtherTabsSynced();

    if (!res?.hasMore) break;
  }
}

/**
 * Cold-start / full-resync path. Runs the EXISTING full-load flow the
 * app used before the engine (`getRooms()` → which itself warms the
 * per-room message caches), then sets `lastEventSeq` to the server's
 * `currentSeq` so subsequent boots take the warm catch-up path.
 */
export async function coldStart(): Promise<void> {
  try {
    // Existing full-load path. `getRooms()` persists rooms to IDB,
    // refreshes the store, and fires `warmRoomCaches` for each room.
    await useRoomStore.getState().getRooms();
  } catch (err) {
    console.error("[syncEngine] coldStart getRooms failed:", err);
  }

  // Establish the cursor from the server's current global seq. A single
  // probe with a very large sinceSeq returns no events but carries
  // `currentSeq`. Failure here is non-fatal — we simply leave the
  // cursor unset and cold-start again next boot.
  try {
    const res = await fetchEvents(COLD_CURSOR_PROBE_SINCE, 1);
    const currentSeq = toNum(res?.currentSeq);
    if (currentSeq > 0) {
      await setMeta(SyncMetaKey.LAST_EVENT_SEQ, currentSeq);
    }
    await setMeta(SyncMetaKey.LAST_SYNC_AT, Date.now());
  } catch (err) {
    console.error("[syncEngine] coldStart cursor probe failed:", err);
  }
}

/**
 * Resolve a backend room reference (Mongo `_id` or custom `roomId`) to
 * the FE-canonical `room.id` (UUID) used as the messages-table roomId
 * key. Falls back to the provided id when the room isn't in the store
 * yet (e.g. event arrived before the room was created locally).
 */
function resolveLocalRoomId(
  roomMongoId?: string,
  customRoomId?: string,
): string | undefined {
  const rooms = useRoomStore.getState().rooms;
  const match = rooms.find(
    (r) =>
      (roomMongoId &&
        (r._id === roomMongoId ||
          r.roomId === roomMongoId ||
          r.id === roomMongoId)) ||
      (customRoomId &&
        (r.roomId === customRoomId ||
          r.id === customRoomId ||
          r._id === customRoomId)),
  );
  return match?.id ?? customRoomId ?? roomMongoId;
}

/**
 * Reducer. Parses the event payload and routes by `type`, reusing
 * existing store mutations wherever possible. Idempotent per entity id.
 *
 * Note: callers run this inside a Dexie `rw` transaction. The store
 * mutations themselves fire their own background IDB writes
 * (fire-and-forget) — those are upsert-by-id so they remain idempotent
 * even though they aren't part of this transaction. The transaction's
 * job is to make the *cursor advance* atomic with the direct table
 * writes the reducer performs (gap markers, message hides/removals).
 */
export async function applyEvent(ev: SyncEventRaw): Promise<void> {
  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(ev.payloadJson ?? "{}");
  } catch {
    console.warn("[syncEngine] bad payloadJson for event", ev.type);
    return;
  }

  switch (ev.type as ChangeEventType) {
    case ChangeEventType.ROOM_NEWMSGS:
      await applyRoomNewMsgs(payload);
      break;
    case ChangeEventType.MESSAGE_UPDATED:
      await applyMessageUpdated(payload);
      break;
    case ChangeEventType.MESSAGE_HIDDEN:
      await applyMessageHidden(payload);
      break;
    case ChangeEventType.ROOM_READ:
      await applyRoomRead(payload);
      break;
    case ChangeEventType.ROOM_UPSERTED:
      await applyRoomUpserted(payload);
      break;
    case ChangeEventType.ROOM_REMOVED:
      await applyRoomRemoved(payload);
      break;
    default:
      // Unknown event type — ignore (forward-compat).
      break;
  }
}

/**
 * `room.newmsgs` → thin high-water-mark. Compare `newestMsgId` with the
 * newest cached message for the room:
 *   - equal → no-op.
 *   - different & room open / recent → pull the new window via the
 *     existing `fetchMessagesFromAPI`(type=new) path.
 *   - different & large gap / room not open → update room
 *     last_message + unread and insert a `__gap` placeholder so the
 *     timeline lazy-loads on scroll.
 */
async function applyRoomNewMsgs(p: Record<string, unknown>): Promise<void> {
  const roomMongoId = p.roomMongoId as string | undefined;
  const customRoomId = p.roomId as string | undefined;
  const newestMsgId = p.newestMsgId as string | undefined;
  const newestMsgTs = p.newestMsgTs as string | undefined;
  const localRoomId = resolveLocalRoomId(roomMongoId, customRoomId);
  if (!localRoomId || !newestMsgId) return;

  const roomStore = useRoomStore.getState();
  const room = roomStore.rooms.find(
    (r) => r.id === localRoomId || r.roomId === localRoomId,
  );

  // Respect a clear_before_ts on the room: a newest message older than
  // the clear cutoff is irrelevant to this user's view → skip.
  const clearBeforeTs = (room as unknown as { clear_before_ts?: string })
    ?.clear_before_ts;
  if (clearBeforeTs && newestMsgTs) {
    if (new Date(newestMsgTs).getTime() <= new Date(clearBeforeTs).getTime()) {
      return;
    }
  }

  // Newest cached message id for this room (compound index, last row).
  let cachedNewest: MessageType | undefined;
  try {
    const rows = await db.messages
      .where("[roomId+createdAt]")
      .between([localRoomId, ""], [localRoomId, "￿"])
      .reverse()
      .limit(1)
      .toArray();
    // Skip gap-marker placeholders when determining the real newest id.
    cachedNewest = rows.find((m) => !m.__gap) ?? rows[0];
  } catch {
    cachedNewest = undefined;
  }
  const cachedNewestId = cachedNewest?.id;

  // Already up to date → idempotent no-op.
  if (cachedNewestId && cachedNewestId === newestMsgId) return;

  const isOpen = roomStore.room?.id === localRoomId;

  if (isOpen) {
    // CHỈ room đang mở mới kéo cửa sổ tin mới (delta). Room khác → gap-marker,
    // lazy-load lúc người dùng mở. Tránh fan-out fetch limit=100 cho hàng loạt
    // room mỗi lần catch-up (đúng thiết kế "chỉ kéo cửa sổ mới nhất + gap").
    void useMessageStore
      .getState()
      .fetchMessagesFromAPI(localRoomId, {
        limit: 100,
        ...(cachedNewestId ? { msgId: cachedNewestId } : {}),
      } as never);
  } else if (newestMsgId !== cachedNewestId) {
    // Room không mở → chèn gap-marker để timeline lazy-load khi cuộn tới.
    await insertGapMarker(localRoomId, newestMsgTs);
  }

  // Always reflect the high-water-mark on the room's last_message +
  // bump unread, so the sidebar shows the new activity even when we
  // didn't pull the body. Reuse the store's room upsert path.
  if (room) {
    const updated: roomType = {
      ...room,
      updatedAt: newestMsgTs || room.updatedAt,
      is_read: false,
      unread_count: (room.unread_count || 0) + 1,
      last_message: {
        ...room.last_message,
        id: newestMsgId,
        createdAt: newestMsgTs || room.last_message?.createdAt || null,
      },
    };
    roomStore.updateRoomSocket(updated);
  }
}

/**
 * Insert a gap-marker placeholder message into a room's timeline. The
 * row carries `__gap: true` and a synthetic id so the UI can render a
 * "load more" marker and lazy-load real messages on scroll. Idempotent:
 * a gap marker for the same room/ts is upserted by a stable id.
 */
async function insertGapMarker(
  localRoomId: string,
  newestMsgTs?: string,
): Promise<void> {
  const ts = newestMsgTs || new Date().toISOString();
  const gapId = `__gap_${localRoomId}`;
  const marker = {
    id: gapId,
    roomId: localRoomId,
    type: "system",
    content: "",
    createdAt: ts,
    pinned: false,
    sender: { _id: "system", id: "system", fullname: "", avatar: "" },
    hiddenAt: null,
    read_by: [],
    isDeleted: false,
    __gap: true,
  } as unknown as MessageType;
  try {
    await db.messages.put(marker);
  } catch (err) {
    console.warn("[syncEngine] insertGapMarker failed", err);
  }
}

/**
 * `message.updated` → fat snapshot. Upsert if the message is already in
 * cache (reuse `upsetMsg`); ignore if not cached (it'll be fetched when
 * the room opens). Idempotent via upsert-by-id.
 */
async function applyMessageUpdated(p: Record<string, unknown>): Promise<void> {
  const msg = p.msg as (MessageType & { _id?: string }) | undefined;
  if (!msg) return;
  const msgId = msg.id ?? msg._id;
  if (!msgId) return;

  // Only apply if we already have this message cached (per the contract:
  // un-cached message.updated is ignored).
  let exists = false;
  try {
    exists = !!(await db.messages.get(msgId));
  } catch {
    exists = false;
  }
  if (!exists) return;

  const normalized: MessageType = { ...msg, id: msgId };
  await useMessageStore.getState().upsetMsg(normalized);
}

/**
 * `message.hidden` → remove/hide the message from this user's cache +
 * state. Idempotent: deleting an absent id is a no-op.
 */
async function applyMessageHidden(p: Record<string, unknown>): Promise<void> {
  const roomMongoId = p.roomMongoId as string | undefined;
  const customRoomId = p.roomId as string | undefined;
  const msgId = p.msgId as string | undefined;
  if (!msgId) return;
  const localRoomId = resolveLocalRoomId(roomMongoId, customRoomId);

  try {
    await db.messages.delete(msgId);
  } catch {
    /* ignore */
  }

  if (localRoomId) {
    // Drop it from the in-memory store too (no store helper exists for a
    // pure local hide, so reuse deleteMessage which only touches state +
    // IDB, not the network).
    await useMessageStore.getState().deleteMessage(localRoomId, msgId);
  }
}

/**
 * `room.read` → update room read state. Reuse `setRoomReaded` (which
 * writes IDB + refreshes state). Idempotent.
 */
async function applyRoomRead(p: Record<string, unknown>): Promise<void> {
  const roomMongoId = p.roomMongoId as string | undefined;
  const customRoomId = p.roomId as string | undefined;
  const lastReadMsgId = p.lastReadMsgId as string | undefined;
  const localRoomId = resolveLocalRoomId(roomMongoId, customRoomId);
  if (!localRoomId || !lastReadMsgId) return;

  await useRoomStore.getState().setRoomReaded({
    lastMessageId: lastReadMsgId,
    roomId: localRoomId,
  });
}

/**
 * `room.upserted` → upsert room metadata. Reuse `updateRoomSocket`
 * (state + IDB upsert by id). Idempotent.
 */
async function applyRoomUpserted(p: Record<string, unknown>): Promise<void> {
  // Payload is a room metadata object. It must carry an `id` for the
  // store upsert to key correctly.
  const room = p as unknown as roomType & { _id?: string };
  const id = room.id ?? (room as { _id?: string })._id;
  if (!id) return;
  useRoomStore.getState().updateRoomSocket({ ...room, id });
}

/**
 * `room.removed` → remove room + its messages from cache + state.
 * Reuse `roomDeleteSocket` (state filter + IDB room/messages delete).
 * Idempotent: removing an absent room is a no-op.
 */
async function applyRoomRemoved(p: Record<string, unknown>): Promise<void> {
  const roomMongoId = p.roomMongoId as string | undefined;
  const customRoomId = p.roomId as string | undefined;
  const localRoomId = resolveLocalRoomId(roomMongoId, customRoomId);
  if (!localRoomId) return;
  useRoomStore.getState().roomDeleteSocket({ roomId: localRoomId });
}

/**
 * Advance the live cursor from a socket event that carries a `seq`.
 * Called by socket handlers after they apply a live event so the
 * catch-up cursor stays in lock-step with the live stream. Monotonic —
 * never moves the cursor backwards.
 */
export async function advanceCursorFromLive(seq: unknown): Promise<void> {
  if (!SYNC_ENGINE_ENABLED) return;
  const n = toNum(seq as number | string);
  if (n <= 0) return;
  try {
    const cur = toNum(await getMeta<number>(SyncMetaKey.LAST_EVENT_SEQ));
    if (n > cur) {
      await setMeta(SyncMetaKey.LAST_EVENT_SEQ, n);
    }
  } catch {
    /* non-fatal */
  }
}
