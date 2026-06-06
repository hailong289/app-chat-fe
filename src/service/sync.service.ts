import apiService from "./api.service";

/**
 * Catch-up sync: pull change-feed (outbox per-user) kể từ con trỏ `sinceSeq`.
 * Trả `{ events[], nextSeq, hasMore, requireFullResync, currentSeq, mayHavePending }`.
 * Xem plan/DONG_BO_EVENT_SYNC_FE_PLAN.md.
 */
export default class SyncService {
  static getEvents({
    sinceSeq,
    limit = 200,
  }: {
    sinceSeq: number;
    limit?: number;
  }) {
    return apiService.get(`/chat/sync/events`, { sinceSeq, limit });
  }
}
