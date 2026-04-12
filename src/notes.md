# Investigation Update

- `Response.success` implementation:
  ```typescript
  static success(data: any, ...) {
    return { ..., metadata: data };
  }
  ```
- Backend `getMsgFromRoom` returns `Response.success(array)`.
- So API returns `{ metadata: [...] }`.
- Frontend `loadOlderMessages` calls `MessageService.getMessages` which calls `apiService.get`.
- `apiService.get` calls `axios`. `axios` returns `{ data: ... }`.
- So `result.data` is `{ metadata: [...] }`.
- `result.data.metadata` is `[...]`.
- **Conclusion**: Data structure is correct.

## Next Suspects

1. **Empty Return**: Backend returns `[]`.
2. **Duplicate Filtering**: `uniqueOlderMessages` logic filters everything out.
3. **State Update Logic**: `displayedMessagesCount` update is not working as expected (though I verified it _should_ work).
4. **Scrolling logic**: `ChatMessages.tsx` triggers load too aggressively or not at all.

I will verify `api-gateway` controller once more.
`gateway-chat.controller.ts`:

```typescript
  @Get('messages/:roomId')
  async GetMsgFromRoom(...) {
     return await this.gatewayService.dispatchGrpcRequest(...)
  }
```

`dispatchGrpcRequest` returns `lastValueFrom(...)`.
If gRPC returns the `Response` object, then it is indeed `{ metadata: [...] }`.

What if the `params` passed to `getMsgFromRoom` are wrong?
Frontend sends: `msgId`, `type='old'`.
Backend uses `msgId` and `type` to build `compare`.

If `msgId` (oldest in frontend) is NOT the one backend expects?
Frontend: `oldestMessage = msgs[0]`.
Messages are sorted by `createdAt` in `groupMessagesByDate`.
So `msgs[0]` is the one with smallest `createdAt`.
This assumes `msgs` matches `messagesRoom[roomId].groups`.

Wait! `useMessageStore.ts`:

```typescript
const currentRoom = get().messagesRoom[roomId];
const msgs = getAllMessagesFromGroups(currentRoom);
// ...
const oldestMessage = msgs[0];
```

Is it possible `getAllMessagesFromGroups` returns in wrong order?
`groupMessagesByDate`:

```typescript
// Ensure messages within group are sorted by createdAt
groupMessages.sort(
  (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
);
```

And groups are sorted by date.
So `msgs[0]` is indeed the oldest.

What if `createdAt` format is different? `isoString`.
`new Date(isoString)` works.

Let's check `getAllMessagesFromGroups` usage.

```typescript
const getAllMessagesFromGroups = (roomData?: RoomData): MessageType[] => {
  if (!roomData?.groups) return [];
  return roomData.groups.flatMap((g) => g.messages);
};
```

Correct.

Maybe `displayedMessagesCount` update is causing a re-render where `sliceVisibleGroups` logic behaves unexpectedly?
If I have 20 messages. `displayedMessagesCount` 20.
Load 20 older. `msgs` size 40. `displayedMessagesCount` 40.
`sliceVisibleGroups` takes last 40.
Correct.

The user says "still not working".
The screenshot shows "Hôm nay" (Today) with 1 message.
This means `msgs` has 1 message?
If so, `loadOlderMessages` gets that 1 message ID.
If backend has messages from "Yesterday"?
It should return them.

What if `DisplayedMessagesCount` is NOT strictly respected?
`ChatMessages.tsx`:

```typescript
const visibleGroups = useMemo(
  () => sliceVisibleGroups(groups, displayedMessagesCount),
  [groups, displayedMessagesCount],
);
```

It looks correct.

Is it possible `olderMessages` returned from backend are NOT older?
Backend sort:

```typescript
      { $sort: { createdAt: -1 } }, // Newest first
      { $limit: Number(limit) },
      { $sort: { createdAt: 1 } }, // Oldest first
```

Returns `[oldest ... newest]` of the chunk.
Chunk is `< msgId`.
So it returns `[... , msgId-1]`.
Frontend prepends: `[...older, ...fresh]`.
Everything is correct.

**Hypothesis**: The backend query fails to find the `msgId`.
`compare._id = { $lt: msgObjectId }`.
If `msgId` from frontend is a string that doesn't match `_id` in DB?
(e.g. slight mismatch, or it's a `id` string vs `_id` ObjectId?)
Frontend `MessageType` has `id`.
DB `Message` has `_id`.
In `sanitizeMessageForDB`:

```typescript
      id: msg.sender.id ,
```

Wait, `msg.id` in frontend vs `_id`?
In `upsertMsg`:

```typescript
const existingIndex = prevMessages.findIndex((m) => m.id === msgData.id);
```

In `fetchMessagesFromAPI`:

```typescript
const messages = response.data.metadata.map((msg: MessageType) => ({
  ...msg,
  // ...
}));
```

Is `msg.id` mapped from `_id`?
Let's check `app-nest-be/libs/db/src/mongo/model/message.model.ts` (oh it failed).
Actually, `sanitizeMessageForDB` in frontend doesn't implicitly map `_id` to `id`.
It assumes `msg` already has `id`.

If `GetMsgFromRoom` returns raw MongoDB documents, they have `_id`.
Does it map `_id` to `id`?
If not, `msg.id` might be undefined or missing if the interface expects `id`.
Frontend `MessageType`:

```typescript
export interface MessageType {
  id: string;
  // ...
}
```

If backend returns `_id` and NO `id`.
Frontend: `msg.id` would be undefined?
If `msg.id` is undefined.
`msgs[0].id` is undefined.
`loadOlderMessages` sends `msgId: undefined`?
`if (!oldestMessageId) { return [] }`.

If so, `loadOlderMessages` does nothing.
AND `fetchMessagesFromAPI`:

```typescript
// Sort theo ID (ObjectId có timestamp embedded)
const sortedMessages = [...mergedMessages].sort((a, b) =>
  a.id.localeCompare(b.id),
);
```

If `id` is missing, `localeCompare` crashes?
The app works for new messages (socket events likely send `id`).
But historical messages?

Let's check `message.model.ts` or the aggregation pipeline.
`buildMessageDetailPipeline` is used in `getMsgFromRoom`.
I need to check `d:\CODE\appchat\app-nest-be\apps\chat\src\handle-chat\Pipeline\getMsg.ts`.

If `id` field is missing in response, that's the bug.
Mongoose documents have `_id`. They don't have `id` by default (unless virtuals).
But `aggregate` returns plain objects. Virtuals are not applied unless explicitly handled?
Unless the pipeline projects `id`?

I will check `getMsg.ts`.
