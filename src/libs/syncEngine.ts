import { db, getCurrentDbUserId, getMeta, setMeta, SYNC_META_KEYS } from "@/libs/db";
import SyncService from "@/service/sync.service";
import {
  ChangeEventType,
  SyncEventItem,
  SyncEventsResponse,
} from "@/types/changeEvent.type";
import useMessageStore from "@/store/useMessageStore";
import useRoomStore from "@/store/useRoomStore";
import { roomType } from "@/store/types/room.state";
import { MessageType } from "@/store/types/message.state";

/**
 * Catch-up sync engine (event-log). Đồng bộ IndexedDB ↔ cloud sau login / mở
 * lại web bằng cách pull change-feed (outbox per-user) kể từ con trỏ
 * `lastEventSeq`. Xem plan/DONG_BO_EVENT_SYNC_FE_PLAN.md.
 *
 * Nguyên tắc:
 * - Apply theo thứ tự `seq` tăng; mọi reducer idempotent (upsert theo entity id)
 *   → re-deliver / trùng socket+outbox cùng `seq` không nhân đôi.
 * - Tiến `lastEventSeq` SAU khi apply thành công từng event → lỗi giữa chừng chỉ
 *   pull lại phần chưa apply (không mất, không double nhờ idempotent).
 * - `requireFullResync` → cold-start (full-load) như luồng cũ.
 */

const PULL_LIMIT = 200;
const MAX_BACKOFF_RETRIES = 4;

/** Unwrap envelope `{metadata}` (gateway bọc gRPC) hoặc trả thẳng body. */
function unwrap(data: unknown): SyncEventsResponse {
  const d = data as { metadata?: SyncEventsResponse } & Partial<SyncEventsResponse>;
  if (d?.metadata && Array.isArray(d.metadata.events)) return d.metadata;
  return d as SyncEventsResponse;
}

/** Tìm room local khớp payload (theo mongo `_id` / business `roomId`). */
function resolveLocalRoom(
  evRoomId: string,
  payload: { roomId?: string; roomMongoId?: string },
): roomType | undefined {
  const rooms = useRoomStore.getState().rooms;
  const mongoId = payload.roomMongoId || evRoomId;
  const bizId = payload.roomId;
  return rooms.find(
    (r) =>
      (mongoId && r._id === mongoId) ||
      (bizId && (r.id === bizId || r.roomId === bizId)) ||
      (mongoId && (r.id === mongoId || r.roomId === mongoId)),
  );
}

/** room.newmsgs (HWM thin) → nâng last_message + unread, hoặc delta-fetch nếu phòng đang mở. */
async function applyRoomNewMsgs(
  evRoomId: string,
  payload: {
    roomId?: string;
    roomMongoId?: string;
    newestMsgId?: string;
    newestMsgTs?: string;
  },
): Promise<void> {
  const room = resolveLocalRoom(evRoomId, payload);
  if (!room) return; // phòng chưa có local → sẽ kéo khi GetRooms/mở
  const cachedNewestId = room.last_message?.id ?? null;
  if (payload.newestMsgId && payload.newestMsgId === cachedNewestId) return; // khớp → bỏ qua

  const roomStore = useRoomStore.getState();
  const isOpen = roomStore.room?.id === room.id;

  // Nâng HWM (last_message id/ts) + unread local. KHÔNG kéo body ở đây — đặt
  // last_message.id = newestMsgId để freshness check ở loadRoomFromCache phát
  // hiện stale rồi delta-fetch khi mở phòng. Preview text tạm cũ tới khi mở.
  const patched: Partial<roomType> = {
    is_read: false,
    unread_count: isOpen ? room.unread_count ?? 0 : (room.unread_count ?? 0) + 1,
    last_message: {
      ...room.last_message,
      id: payload.newestMsgId ?? room.last_message?.id ?? null,
      createdAt: payload.newestMsgTs ?? room.last_message?.createdAt ?? null,
    },
    updatedAt: payload.newestMsgTs ?? room.updatedAt,
  };
  try {
    await db.rooms.update(room.id, patched);
  } catch {
    /* db lỗi → bỏ qua, GetRooms sau bù */
  }
  await roomStore.getRoomsByType(roomStore.type);

  // Phòng đang mở → kéo cửa sổ tin mới qua loadRoomFromCache (tự so
  // last_message.id mới ↔ cache → delta-fetch body). Tái dùng nguyên cơ chế cũ.
  if (isOpen) {
    await useMessageStore.getState().loadRoomFromCache(room.id);
  }
}

/** Apply MỘT change-event vào IndexedDB + store (tái dùng action sẵn có). */
async function applyEvent(ev: SyncEventItem): Promise<void> {
  let payload: Record<string, unknown> = {};
  try {
    payload = ev.payloadJson ? JSON.parse(ev.payloadJson) : {};
  } catch {
    payload = {};
  }
  const messageStore = useMessageStore.getState();
  const roomStore = useRoomStore.getState();

  switch (ev.type) {
    case ChangeEventType.ROOM_NEWMSGS:
      await applyRoomNewMsgs(ev.roomId, payload as never);
      break;

    case ChangeEventType.MESSAGE_UPDATED: {
      const msg = payload.msg as MessageType | undefined;
      if (msg?.id) await messageStore.upsetMsg(msg);
      break;
    }

    case ChangeEventType.MESSAGE_HIDDEN: {
      const roomId = (payload.roomId as string) || ev.roomId;
      const msgId = payload.msgId as string;
      if (msgId) await messageStore.removeMessageLocal(roomId, msgId);
      break;
    }

    case ChangeEventType.ROOM_READ: {
      const room = resolveLocalRoom(ev.roomId, payload as never);
      const lastReadMsgId = payload.lastReadMsgId as string;
      if (room && lastReadMsgId) {
        await roomStore.setRoomReaded({
          lastMessageId: lastReadMsgId,
          roomId: room.id,
        });
      }
      break;
    }

    case ChangeEventType.ROOM_UPSERTED: {
      // payload = room metadata snapshot. Tái dùng updateRoomSocket (upsert).
      const room = (payload.room as roomType) || (payload as unknown as roomType);
      if (room && (room.id || room._id)) roomStore.updateRoomSocket(room);
      break;
    }

    case ChangeEventType.ROOM_REMOVED: {
      const room = resolveLocalRoom(ev.roomId, payload as never);
      const roomId = room?.id || (payload.roomId as string);
      if (roomId) roomStore.roomDeleteSocket({ roomId });
      break;
    }

    default:
      // type lạ (BE thêm mới) → bỏ qua an toàn, vẫn tiến cursor.
      break;
  }
}

const sleep = (ms: number) =>
  new Promise<void>((res) => setTimeout(res, ms));

/** Pull-loop catch-up từ con trỏ hiện tại. KHÔNG tự cold-start (caller quyết). */
async function pullLoop(startSeq: number): Promise<void> {
  let seq = startSeq;
  let backoff = 0;

  for (;;) {
    const res = await SyncService.getEvents({ sinceSeq: seq, limit: PULL_LIMIT });
    const body = unwrap(res.data);

    if (body.requireFullResync) {
      await coldStart();
      return;
    }

    const events = body.events ?? [];
    let lastOk = seq;
    for (const ev of events) {
      try {
        await applyEvent(ev);
        lastOk = ev.seq;
      } catch (err) {
        console.error("[syncEngine] applyEvent failed @seq", ev.seq, err);
        break; // dừng batch → cursor ở event cuối OK, lần sau pull lại từ đó
      }
    }
    if (lastOk > seq) {
      seq = lastOk;
      await setMeta(SYNC_META_KEYS.LAST_EVENT_SEQ, seq);
    }

    if (body.hasMore && lastOk === body.nextSeq) {
      backoff = 0;
      continue; // còn trang → kéo tiếp ngay
    }

    // Consumer outbox đang lag (đã cấp seq nhưng chưa ghi) → retry-có-backoff.
    if (body.mayHavePending && backoff < MAX_BACKOFF_RETRIES) {
      await sleep(500 * 2 ** backoff);
      backoff += 1;
      continue;
    }
    break;
  }
  await setMeta(SYNC_META_KEYS.LAST_SYNC_AT, Date.now());
}

/**
 * Cold-start: luồng full-load cũ (getRooms → warmRoomCaches bên trong) rồi đặt
 * con trỏ = `currentSeq` server. Dùng cho lần đầu login / cursor quá cũ.
 */
export async function coldStart(): Promise<void> {
  await useRoomStore.getState().getRooms();
  // Probe lấy mốc seq toàn cục hiện tại (sinceSeq cực lớn → events rỗng).
  let currentSeq = 0;
  try {
    const probe = await SyncService.getEvents({
      sinceSeq: Number.MAX_SAFE_INTEGER,
      limit: 1,
    });
    currentSeq = unwrap(probe.data).currentSeq ?? 0;
  } catch (err) {
    console.error("[syncEngine] coldStart probe failed", err);
  }
  await setMeta(SYNC_META_KEYS.LAST_EVENT_SEQ, currentSeq);
  await setMeta(SYNC_META_KEYS.LAST_SYNC_AT, Date.now());
}

/**
 * Tiến con trỏ `lastEventSeq` từ một live socket event mang `seq` (max, không
 * downgrade). No-op nếu chưa có baseline (cursor null) — để coldStart/catch-up
 * đặt mốc trước, tránh "đầu độc" con trỏ làm bỏ sót event cũ chưa pull.
 */
export async function advanceCursor(seq?: number): Promise<void> {
  if (!seq || typeof seq !== "number") return;
  const cur = await getMeta<number>(SYNC_META_KEYS.LAST_EVENT_SEQ);
  if (cur == null) return;
  if (seq > Number(cur)) {
    await setMeta(SYNC_META_KEYS.LAST_EVENT_SEQ, seq);
  }
}

/** Lõi catch-up: chọn cold/warm theo cursor. */
async function catchupCore(): Promise<void> {
  const seq = await getMeta<number>(SYNC_META_KEYS.LAST_EVENT_SEQ);
  if (seq == null) {
    await coldStart();
    return;
  }
  await pullLoop(Number(seq) || 0);
}

let inFlight: Promise<void> | null = null;

/**
 * Điểm vào catch-up. Dùng ở boot + reconnect. Idempotent & rẻ nếu không có gì
 * mới. Multi-tab: chỉ tab giữ Web Lock `chat-sync-<userId>` mới pull; tab khác
 * bỏ qua và đồng bộ qua BroadcastChannel `chat-sync` (xem initSyncListener).
 */
export async function runCatchupSync(): Promise<void> {
  if (inFlight) return inFlight; // chống chồng lệnh trong cùng tab
  inFlight = (async () => {
    try {
      const userId = getCurrentDbUserId() ?? "anon";
      const lockName = `chat-sync-${userId}`;
      const locks = (navigator as Navigator & { locks?: LockManager }).locks;
      if (locks?.request) {
        // ifAvailable: tab khác đang giữ lock → trả null → bỏ qua pull (leader lo).
        await locks.request(lockName, { ifAvailable: true }, async (lock) => {
          if (!lock) return; // không phải leader
          await catchupCore();
          broadcastSynced();
        });
      } else {
        // Trình duyệt không hỗ trợ Web Locks → chạy thẳng (chấp nhận double-pull hiếm).
        await catchupCore();
        broadcastSynced();
      }
    } catch (err) {
      console.error("[syncEngine] runCatchupSync failed", err);
    }
  })();
  try {
    await inFlight;
  } finally {
    inFlight = null;
  }
}

// ── Multi-tab: BroadcastChannel để các tab non-leader refresh từ IndexedDB ─────
let channel: BroadcastChannel | null = null;
function getChannel(): BroadcastChannel | null {
  if (typeof BroadcastChannel === "undefined") return null;
  if (!channel) channel = new BroadcastChannel("chat-sync");
  return channel;
}
function broadcastSynced(): void {
  getChannel()?.postMessage({ type: "synced", at: Date.now() });
}

let listenerInit = false;
/**
 * Tab non-leader: nghe 'synced' từ leader → re-hydrate sidebar từ IndexedDB +
 * reload phòng đang mở từ cache (không tự pull network). Gọi 1 lần ở boot.
 */
export function initSyncListener(): void {
  if (listenerInit) return;
  const ch = getChannel();
  if (!ch) return;
  listenerInit = true;
  ch.onmessage = (e: MessageEvent) => {
    if (e.data?.type !== "synced") return;
    const roomStore = useRoomStore.getState();
    void roomStore.getRoomsByType(roomStore.type);
    const openRoomId = roomStore.room?.id;
    if (openRoomId) {
      void useMessageStore.getState().loadRoomFromCache(openRoomId);
    }
  };
}
