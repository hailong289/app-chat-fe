/**
 * Pure status helpers — no store/socket. Status is DERIVED from each member's
 * delivered/read watermark vs the message's position in the room timeline.
 */
type AnyMsg = Record<string, any>;
type Member = { id?: string; user_id?: string; last_delivered_id?: string | null; last_read_id?: string | null };
type Room = { room_type?: string; members?: Member[] };

const memberId = (m: Member) => String(m.id ?? m.user_id ?? "");

const pos = (id: string | null | undefined, order: string[]) =>
  id == null ? -1 : order.indexOf(String(id));

const reached = (watermark: string | null | undefined, msgId: string, order: string[]) => {
  const w = pos(watermark, order);
  const m = pos(msgId, order);
  if (w === -1 || m === -1) return false;
  return w >= m;
};

const isEmptyArr = (v: unknown) => !Array.isArray(v) || v.length === 0;

export function mergeLeanSafe(existing: AnyMsg | undefined, incoming: AnyMsg): AnyMsg {
  if (!existing) return incoming;
  if (!incoming._lean) return { ...existing, ...incoming };
  const merged: AnyMsg = { ...existing, ...incoming };
  if (isEmptyArr(incoming.attachments) && !isEmptyArr(existing.attachments)) merged.attachments = existing.attachments;
  if (isEmptyArr(incoming.reactions) && !isEmptyArr(existing.reactions)) merged.reactions = existing.reactions;
  if (isEmptyArr(incoming.read_by) && !isEmptyArr(existing.read_by)) merged.read_by = existing.read_by;
  if (!incoming.status && existing.status) merged.status = existing.status;
  return merged;
}

const senderId = (msg: AnyMsg) => String(msg.sender?.id ?? msg.sender?._id ?? "");

export function deriveStatus(
  msg: AnyMsg,
  room: Room,
  currentUserId: string,
  order: string[],
): "read" | "delivered" | "sent" | null {
  if (senderId(msg) !== String(currentUserId)) return null;
  const others = (room.members ?? []).filter((m) => memberId(m) !== String(currentUserId));
  if (others.length === 0) return "sent";
  const allRead = others.every((m) => reached(m.last_read_id, msg.id, order));
  if (allRead) return "read";
  const anyDelivered = others.some((m) => reached(m.last_delivered_id, msg.id, order) || reached(m.last_read_id, msg.id, order));
  if (anyDelivered) return "delivered";
  return "sent";
}

export function deriveGroupCounts(
  msg: AnyMsg,
  room: Room,
  currentUserId: string,
  order: string[],
): { deliveredCount: number; readCount: number; total: number } {
  const others = (room.members ?? []).filter((m) => memberId(m) !== String(currentUserId));
  let deliveredCount = 0;
  let readCount = 0;
  for (const m of others) {
    const read = reached(m.last_read_id, msg.id, order);
    const delivered = read || reached(m.last_delivered_id, msg.id, order);
    if (delivered) deliveredCount++;
    if (read) readCount++;
  }
  return { deliveredCount, readCount, total: others.length };
}
