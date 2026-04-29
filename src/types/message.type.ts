
export interface GetMessageType {
    roomId: string;
    queryParams?: {
        limit?: number;
        // 'new' + msgId → delta sync (messages newer than the FE's
        // last cached id). 'old' + msgId → infinite-scroll older.
        // 'around' + msgId → context window centered on msgId, used
        //   by jump-to-message / search-result navigation when the
        //   target isn't in the cache and we need both sides.
        // omitted → fetch latest `limit` messages.
        type?: 'new' | 'old' | 'around';
        msgId?: string;
    }
}