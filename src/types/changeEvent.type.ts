/**
 * Các loại event change-feed (outbox per-user) BE phát cho catch-up sync.
 * PHẢI khớp `ChangeEventType` ở BE (app-nest-be/libs/dto/src/enum.type.ts).
 * Xem plan/DONG_BO_EVENT_SYNC_FE_PLAN.md.
 */
export enum ChangeEventType {
  /** Tin mới trong phòng (HWM, thin): `{roomId, roomMongoId, newestMsgId, newestMsgTs}`. */
  ROOM_NEWMSGS = "room.newmsgs",
  /** edit/react/pin/recall (fat): `{roomId, roomMongoId, msg}`. */
  MESSAGE_UPDATED = "message.updated",
  /** delete-for-me (thin, per-user): `{roomId, roomMongoId, msgId}`. */
  MESSAGE_HIDDEN = "message.hidden",
  /** đổi con trỏ đọc (fat, per-user): `{roomId, roomMongoId, lastReadMsgId, lastReadAt, unreadCount}`. */
  ROOM_READ = "room.read",
  /** tạo/đổi tên/avatar/member/pin-list (fat): room metadata. */
  ROOM_UPSERTED = "room.upserted",
  /** bị kick/rời/xoá phòng (thin, per-user): `{roomId, roomMongoId}`. */
  ROOM_REMOVED = "room.removed",
}

/** Một event trả về từ `GET /chat/sync/events`. `payload` đã serialize JSON. */
export interface SyncEventItem {
  seq: number;
  type: ChangeEventType | string;
  roomId: string;
  payloadJson: string;
  createdAt: string;
}

/** Response của `GET /chat/sync/events`. */
export interface SyncEventsResponse {
  events: SyncEventItem[];
  nextSeq: number;
  hasMore: boolean;
  requireFullResync: boolean;
  currentSeq: number;
  mayHavePending: boolean;
}
