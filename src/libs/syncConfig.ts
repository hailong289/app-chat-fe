/**
 * Catch-up sync engine feature flag. Tách riêng khỏi `syncEngine.ts` để các
 * module nền (vd `useRoomStore`) đọc được mà không tạo vòng import với
 * `syncEngine` (vốn đã import useRoomStore/useMessageStore).
 *
 * `false` → quay về luồng full-load cũ ở mọi điểm tích hợp (boot, getRooms
 * prefetch, socket cursor). Kill-switch phía FE, đối xứng với BE
 * `CHANGEFEED_ENABLED`.
 */
export const SYNC_ENGINE_ENABLED = true;
