/**
 * Vòng đời trạng thái MỘT tin nhắn (5 trạng thái chuẩn) — dùng thống nhất thay
 * cho string literal rải rác. Xem plan/DONG_BO_EVENT_SYNC_FE_PLAN.md (§8).
 *
 * Lưu ý: `RECALLED` là trạng thái HIỂN THỊ trực giao (tin đã thu hồi), KHÔNG
 * thuộc chuỗi gửi 5 bước — tách riêng để không vỡ logic recall hiện có.
 *
 * Đây KHÁC với `FilePreview.status` (trạng thái upload từng attachment ở
 * components/chat/file/*) — đừng nhầm lẫn.
 */
export enum MessageStatus {
  /** Đang gửi: local optimistic, CHƯA có `seq` (gồm text in-flight + đang upload). */
  SENDING = "sending",
  /** Đã lên server: `msg.seq` đã được cấp (committed). */
  SENT = "sent",
  /** Đã tới máy người nhận: live-only (`message:status` status=delivered). */
  DELIVERED = "delivered",
  /** Đã đọc: `read_by.length > 0` / `room.read`. */
  READ = "read",
  /** Lỗi gửi: timeout / `error:message` / phòng bị xoá. */
  FAILED = "failed",
  /** Trực giao: tin đã thu hồi (hiển thị placeholder). */
  RECALLED = "recalled",
}

/** Thứ hạng chuỗi gửi để merge "không bao giờ downgrade". */
const LIFECYCLE_RANK: Record<string, number> = {
  [MessageStatus.SENDING]: 0,
  [MessageStatus.SENT]: 1,
  [MessageStatus.DELIVERED]: 2,
  [MessageStatus.READ]: 3,
};

/**
 * Merge trạng thái theo precedence `READ > DELIVERED > SENT > SENDING` — không
 * downgrade (vd live `delivered` đến sau khi đã `READ` → giữ `READ`).
 * `FAILED`/`RECALLED` là trạng thái tường minh: `next` là một trong hai → áp luôn;
 * còn `cur === RECALLED` thì giữ nguyên (đã thu hồi không quay lại lifecycle).
 */
export function mergeStatus(
  cur: MessageStatus | string | undefined | null,
  next: MessageStatus,
): MessageStatus {
  if (next === MessageStatus.FAILED || next === MessageStatus.RECALLED) {
    return next;
  }
  if (cur === MessageStatus.RECALLED) return MessageStatus.RECALLED;
  const cr = LIFECYCLE_RANK[cur ?? ""] ?? -1;
  const nr = LIFECYCLE_RANK[next] ?? -1;
  return nr > cr ? next : (cur as MessageStatus) ?? next;
}
