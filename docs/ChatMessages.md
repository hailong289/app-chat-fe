# ChatMessages component — documentation

Path: `src/components/chat/ChatMessages.tsx`

## Purpose

`ChatMessages` renders a chat timeline for a given room (`chatId`) and handles message-related UI and user actions (reply, react, pin/gim, recall, delete). It groups messages by day, supports virtualized pagination (rendering a subset for performance), and integrates with the app's socket and message store.

This document summarizes responsibilities, data shape expectations, UI rules (especially around deletions vs recalls), socket events emitted/consumed, optimistic update strategy, and debugging tips.

---

## Public contract / Props

- Props:

  - `chatId: string` — the room id whose messages should be displayed.

- Dependencies (via hooks / stores):
  - `useMessageStore()` — reads & mutates local message store (messagesRoom, upsetMsg, recallMessage, resendMessage, etc.).
  - `useRoomStore()` — room metadata (last read id, unread counts, markMessageAsRead).
  - `useSocket()` — socket.io client instance for emitting events.
  - `useToast()` — for user feedback toasts.

## Message model / important flags

The component relies on a message object with these fields (not exhaustive):

- `id` or `_id` — unique identifier.
- `roomId` — ID of the chat room.
- `content` — text content.
- `attachments` — array of attachment objects.
- `createdAt` — timestamp.
- `isMine` — boolean: message originated from current user.
- `status` — string: e.g., `pending`, `delivered`, `recalled`, `failed`, `uploading`.
- `isDeleted` — boolean: used to indicate the message was recalled (thu hồi). Historically code also uses `status === 'recalled'`.
- `hiddenByMe` — boolean: indicates this message was deleted by the current user (xoá). Important: deleted-by-me messages should show a placeholder "Bạn đã xoá tin nhắn này" rather than being removed entirely.
- `pinned` — boolean.
- `reply` — minimal preview object for the message this one replies to (may include `isDeleted` / `hiddenByMe`).

Rules:

- hiddenByMe === true → message was deleted by the current user (xoá). The UI shows "Bạn đã xoá tin nhắn này" for your messages and "Tin nhắn đã bị xoá" for others.
- isDeleted === true or status === 'recalled' → message was recalled (thu hồi). The UI shows "Bạn đã thu hồi tin nhắn này" for your messages or "Tin nhắn đã bị thu hồi" for others.

## Rendering behaviour

- Virtualization: only the last `displayedMessagesCount` messages are rendered (configurable).
- Date grouping: messages are grouped by day using `groupMessagesByDate`.
- Deleted / recalled messages are rendered as lightweight placeholders (italic, muted). Attachments, reactions and action menus are hidden for such messages.
- Reply preview (`ReplyPreview`) inspects the reply object and displays:
  - Deleted (hiddenByMe) → "Tin nhắn đã bị xoá" (or "Bạn đã xoá tin nhắn này" when reply.isMine)
  - Recalled (isDeleted/status==='recalled') → "Bạn đã thu hồi tin nhắn này" (if reply.isMine) or "Tin nhắn đã bị thu hồi"

## Actions & socket events emitted

- `message:emoji` — send a reaction (emoji). Payload: { roomId, msgId, emoji }
- `message:delete` — request server to delete (hiddenByMe) a message you authored. Payload: { roomId, msgId }
- `message:recall` — request server to recall (isDeleted/status='recalled') a message you authored. Payload: { roomId, msgId, placeholder }
- `message:pin` — toggle pin. Payload: { roomId, msgId, pinned }

Implementation notes:

- The component performs optimistic updates via `messageState.upsetMsg(...)` or `messageState.recallMessage(...)` immediately to keep UI snappy.
- Emissions use an `emitWithAck` helper which attempts to get an acknowledgement from the server (with a timeout). The helper resolves with a normalized ack object `{ ok: boolean, error?: string, ... }`. The component rolls back optimistic changes if ack.ok === false.

## Optimistic update strategy and reconciliation

- On delete/recall/pin actions the component:
  1. Saves `original = { ...msg }`.
  2. Performs an optimistic update in the local store to reflect the requested change.
  3. Calls `emitWithAck(event, payload, timeout)`.
  4. If the ack returns `{ ok: false, error }` or times out (ack.error === 'ack-timeout'), the component rolls back by writing `original` back to the store and shows an error toast.
  5. If success, shows a success toast.

Reason: optimistic UX + safe rollback in case the server rejects or doesn't respond.

## Debugging tips (why you may see "thu hồi" instead of "xoá")

If you see a message you've deleted (`hiddenByMe: true`) appear as recalled (`status: 'recalled'` or `isDeleted: true`) then one of these likely happened:

1. Server-side behaviour: the server acknowledged your delete request but broadcasted a message:update (message:upset) marking the message as recalled rather than hiddenByMe. Fix on server side is required.
2. A different client or a server process later updated the message to `isDeleted`/`status: 'recalled'`.
3. A local client bug is calling `recallMessage()` or setting `isDeleted` after your optimistic delete; check for other code paths that mutate the store after `upsetMsg`.

To capture and inspect incoming payloads:

- Temporarily add a debug wrapper in `src/components/socketEventGlobal.tsx` for incoming events like `message:upset` that logs `{ id, hiddenByMe, isDeleted, status }`.
- Alternatively, after reproducing the action, inspect the store in DevTools console:

```js
// run in browser console while app is running
const m = useMessageStore
  .getState()
  .messagesRoom["<roomId>"].messages.find((m) => m.id === "<msgId>");
console.log("message-in-store", m);
```

Look for the moment when the message's `hiddenByMe` → `true` and if later `isDeleted` or `status` changes.

## Tests & quick checks

- Typecheck with TypeScript:

```powershell
npx tsc --noEmit
```

- Dev run (Next.js Turbopack):

```powershell
npm run dev
```

- Reproduce flow manually in browser:
  1. Open chat with a message you authored.
  2. Click delete (Xoá). Observe the optimistic UI change.
  3. Check browser console for `emit:message:delete ack:` debug logs.
  4. If inconsistent, inspect store as shown above or enable incoming socket logging.

## Known issues & recommendations

- The `emitWithAck` helper resolves with a normalized object instead of rejecting; callers must check `ack.ok`.
- If your server frequently takes longer than the ack timeout, either increase the timeout or remove optimistic rollback and rely on server-sourced updates.
- Consider centralizing message action logic (delete/recall/pin) into a shared hook (e.g., `useMessageActions`) to reduce duplication and better manage inflight requests.

## How to change the placeholder text or styling

File: `src/components/chat/ChatMessages.tsx` — the placeholder rendering for deleted/recalled messages appears in the `renderContentBubble` function (search for `if (msg.hiddenByMe)` / `if (msg.isDeleted)`).

Change the text nodes to adjust messaging, or add a special CSS utility class to change the visual style.

---

If you want, I can:

- Add a small unit/integration test harness for the message-store reconciliation logic.
- Add the temporary inbound socket logging to `src/components/socketEventGlobal.tsx` so you can capture the server broadcast that overwrites flags.
- Move `emitWithAck` to `src/libs/emitWithAck.ts` and reuse it across components.

Tell me which follow-up you'd like and I'll implement it next.
