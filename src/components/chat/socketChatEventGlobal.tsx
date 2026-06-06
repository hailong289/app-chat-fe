"use client";

import { useEffect, useRef } from "react";
import { useSocket } from "../providers/SocketProvider";
import useRoomStore from "@/store/useRoomStore";
import useMessageStore from "@/store/useMessageStore";
import useContactStore from "@/store/useContactStore";
import { socketEvent } from "@/types/socketEvent.type";
import { advanceCursor, runCatchupSync } from "@/libs/syncEngine";
import { MessageStatus } from "@/types/messageStatus.type";
import useAuthStore from "@/store/useAuthStore";
import useCallStore from "@/store/useCallStore";
import { useOnlinePresence } from "./hooks/useOnlinePresence";
import { IncomingCallModal } from "../call/IncomingCallModal";

export const SocketEventChatGlobal = () => {
  const { socket: msgSocket } = useSocket("/chat");
  const { socket: call } = useSocket("/call");
  const roomState = useRoomStore((state) => state);
  const contactState = useContactStore((state) => state);
  const messageState = useMessageStore((state) => state);

  // Enable online presence heartbeat on every namespace this client uses.
  // Each socket has its own SOCKET_ALIVE TTL on the BE; the cron prunes
  // members whose alive key expires. Sending a heartbeat per socket keeps
  // them all "live" so the cron doesn't churn legitimate connections.
  useOnlinePresence(msgSocket);
  useOnlinePresence(call);

  // Stable handler refs — Socket.IO off() requires the exact same function
  // reference that was passed to on(). Using arrow functions inline in both
  // on() and off() would create different objects → listeners never removed →
  // they accumulate and fire multiple times per event → multiple call windows.
  const onCallRequest = useRef((payload: any) =>
    useCallStore.getState().eventCall("request", payload)
  );
  const onMsgUpsertCall = useRef((payload: any) =>
    useMessageStore.getState().upsetMsg(payload)
  );
  const onRoomRefresh = useRef((data: any) =>
    useRoomStore.getState().fetchAndUpdateRoom(data.roomId)
  );
  const onCallBusy = useRef((payload: any) =>
    useCallStore.getState().eventCall("busy", payload)
  );

  // Giữ ref socket /chat cập nhật để các handler ổn định (useRef) emit được.
  const socketRef = useRef<any>(null);
  useEffect(() => {
    socketRef.current = msgSocket;
  }, [msgSocket]);

  // Live MSGUPSERT: apply tin + TIẾN con trỏ catch-up từ `msg.seq` (một nguồn
  // seq duy nhất cho cả live + catch-up). advanceCursor no-op nếu chưa có baseline.
  // Đồng thời ACK "delivered" về người gửi khi tin của NGƯỜI KHÁC vừa tới máy mình.
  const onMsgUpsert = useRef((msg: any) => {
    useMessageStore.getState().upsetMsg(msg);
    void advanceCursor(msg?.seq);
    try {
      const me = useAuthStore.getState().user?._id;
      const senderId = msg?.sender?._id; // mongo _id (khớp ROOM_CLIENT ở BE)
      if (me && senderId && senderId !== me && msg?.id) {
        socketRef.current?.emit(socketEvent.MSGDELIVERED, {
          roomId: msg.roomId,
          msgId: msg.id,
          senderId,
        });
      }
    } catch {
      /* ack delivered là best-effort */
    }
  });

  // Người gửi nhận "delivered" (live, ephemeral) → set DELIVERED (không đè READ).
  const onMsgStatus = useRef(
    (data: { roomId: string; msgId?: string; status?: string }) => {
      if (data?.status === "delivered" && data.msgId) {
        useMessageStore
          .getState()
          .setMessageStatus(data.roomId, data.msgId, MessageStatus.DELIVERED);
      }
    },
  );

  // ── Message action inbound handlers ──────────────────────────────
  // Backend broadcasts updated messages via message:upsert after each
  // action (react/pin/delete/recall). These explicit listeners provide
  // a safety net in case the backend emits dedicated events.
  const onMsgReact = useRef((msg: any) => {
    useMessageStore.getState().upsetMsg(msg);
    void advanceCursor(msg?.seq);
  });
  const onMsgPinned = useRef((msg: any) => {
    useMessageStore.getState().upsetMsg(msg);
    void advanceCursor(msg?.seq);
    if (msg.roomId) {
      useRoomStore.getState().updatePinnedMessageFromSocket(msg.roomId, msg);
    }
  });
  const onMsgDelete = useRef((msg: any) => {
    useMessageStore.getState().upsetMsg(msg);
    void advanceCursor(msg?.seq);
  });
  const onMsgRecall = useRef((msg: any) => {
    useMessageStore.getState().upsetMsg(msg);
    void advanceCursor(msg?.seq);
  });

  // Reconnect: socket nối lại sau khi rớt mạng → catch-up vá phần event đã miss
  // (rẻ nếu không có gì mới). Bao mọi phòng, không chỉ phòng đang mở.
  const onReconnectSync = useRef(() => {
    void runCatchupSync();
  });

  // Multi-device handoff: this user accepted/joined the call from another
  // device → server tells THIS tab to release. We don't have a popup yet
  // (modal still showing), so just clear the incoming modal silently.
  const onCallHandoff = useRef((_payload: any) => {
    useCallStore.getState().clearIncomingCall();
  });

  /**
   * call:end → force-refresh the corresponding call message bubble in
   * the chat list with the latest `history.members` snapshot. The BE
   * also emits a separate MSGUPSERT for the same message after
   * endCall, but we don't want to depend on that arriving — Mongoose
   * write/read interleave + aggregation lookup occasionally returns
   * stale members and the bubble gets stuck on "Ongoing" / no rejoin
   * button. Patching directly from the call:end payload guarantees
   * the bubble reflects reality the moment the BE confirms the leave.
   */
  const onCallEnd = useRef(
    (payload: {
      callId?: string;
      roomId?: string;
      history?: {
        members?: any[];
        ended_at?: string | null;
      };
      members?: any[];
    }) => {
      try {
        // Find the call bubble by callId (the only stable reference
        // back to the message — `members` array doesn't carry it).
        // FE store keeps `call_history.call_id` on each `type: 'call'`
        // message → patch members + ended_at on that bubble.
        const callId = payload?.callId;
        const roomId = payload?.roomId;
        const members = payload?.history?.members ?? payload?.members;
        if (!callId || !roomId || !Array.isArray(members)) return;
        useMessageStore.getState().patchCallMessage(roomId, callId, {
          members,
          ended_at: payload?.history?.ended_at ?? null,
        });
      } catch (err) {
        console.warn("[onCallEnd] patchCallMessage failed", err);
      }
    },
  );

  const handleUpdateQuiz = useRef((data: { roomId: string; quizId: string; payload: Record<string, unknown> }) => {
    useMessageStore.getState().updateQuizInMessages(data.roomId, String(data.quizId), data.payload);
  });

  // Stable handlers for the unified presence events. The BE always emits
  // single transitions on `STATUS` and bulk responses on `status:online:bulk`
  // — both have the same per-user shape, so we just route them through
  // socketHandleOnline / socketHandleOnlineBulk.
  const onStatus = useRef(
    (data: { id: string; isOnline: boolean; onlineAt?: string | null }) =>
      useContactStore.getState().socketHandleOnline({
        id: data.id,
        isOnline: data.isOnline,
        onlineAt: data.onlineAt ?? null,
      }),
  );
  const onStatusBulk = useRef(
    (data: {
      users: Array<{
        id: string;
        isOnline: boolean;
        onlineAt?: string | null;
      }>;
    }) =>
      useContactStore.getState().socketHandleOnlineBulk(data?.users ?? []),
  );

  // Bind the global /call socket into useCallStore so the IncomingCallModal
  // (which lives in this main window, NOT the call popup) can emit
  // `call:end` for reject / miss BEFORE the popup ever opens. Without this
  // binding `useCallStore.socket` stays null until the popup mounts and
  // sets it, so reject from the modal silently no-ops and the caller
  // never sees the "rejected" state.
  useEffect(() => {
    if (!call) return;
    useCallStore.setState({ socket: call });
    return () => {
      // Only clear if no popup has overwritten this binding with its own
      // /call socket — the popup's socket lives longer than this window's
      // reference and is the one that should be used during an active call.
      if (useCallStore.getState().socket === call) {
        useCallStore.setState({ socket: null });
      }
    };
  }, [call]);

  useEffect(() => {
    if (!msgSocket || !call) return;
    msgSocket.on(socketEvent.MSGUPSERT, onMsgUpsert.current);
    msgSocket.on(socketEvent.MSGSTATUS, onMsgStatus.current);
    msgSocket.on("connect", onReconnectSync.current);
    msgSocket.on(socketEvent.MSGMARKREAD, roomState.setRoomReaded);
    msgSocket.on(socketEvent.STATUS, onStatus.current);
    msgSocket.on("status:online:bulk", onStatusBulk.current);
    msgSocket.on(socketEvent.ROOMDELETE, roomState.roomDeleteSocket);
    msgSocket.on(socketEvent.ERRORMSG, messageState.upsetMsgError);
    msgSocket.on(socketEvent.STATUSTYPING, roomState.handleTypingEvent);
    call.on(socketEvent.CALL, onCallRequest.current);
    call.on(socketEvent.MSGUPSERT, onMsgUpsertCall.current);
    call.on("call:end", onCallEnd.current);
    call.on("call:busy", onCallBusy.current);
    call.on("call:handoff", onCallHandoff.current);
    msgSocket.on(socketEvent.ROOM_REFRESH, onRoomRefresh.current);
    msgSocket.on(socketEvent.UPDATE_QUIZ, handleUpdateQuiz.current);
    msgSocket.on(socketEvent.MSGREACT, onMsgReact.current);
    msgSocket.on(socketEvent.MSGPINNED, onMsgPinned.current);
    msgSocket.on(socketEvent.MSGDELETE, onMsgDelete.current);
    msgSocket.on(socketEvent.MSGRECALL, onMsgRecall.current);

    // Periodic presence refresh — covers the case where the user opened
    // their friend list 5 minutes after app start and would otherwise see
    // stale online dots until someone toggles. 60s cadence is a comfort
    // baseline; presence events still drive real-time accuracy.
    const refreshInterval = setInterval(() => {
      try {
        useContactStore.getState().checkOnlineStatus(msgSocket);
      } catch {
        /* no-op — refresh failures are harmless */
      }
    }, 60_000);

    return () => {
      clearInterval(refreshInterval);
      call.off(socketEvent.CALL, onCallRequest.current);
      call.off(socketEvent.MSGUPSERT, onMsgUpsertCall.current);
      call.off("call:end", onCallEnd.current);
      call.off("call:busy", onCallBusy.current);
      call.off("call:handoff", onCallHandoff.current);
      msgSocket.off(socketEvent.MSGUPSERT, onMsgUpsert.current);
      msgSocket.off(socketEvent.MSGSTATUS, onMsgStatus.current);
      msgSocket.off("connect", onReconnectSync.current);
      msgSocket.off(socketEvent.MSGMARKREAD, roomState.setRoomReaded);
      msgSocket.off(socketEvent.STATUS, onStatus.current);
      msgSocket.off("status:online:bulk", onStatusBulk.current);
      msgSocket.off(socketEvent.ROOMDELETE, roomState.roomDeleteSocket);
      msgSocket.off(socketEvent.ERRORMSG, messageState.upsetMsgError);
      msgSocket.off(socketEvent.STATUSTYPING, roomState.handleTypingEvent);
      msgSocket.off(socketEvent.ROOM_REFRESH, onRoomRefresh.current);
      msgSocket.off(socketEvent.UPDATE_QUIZ, handleUpdateQuiz.current);
      msgSocket.off(socketEvent.MSGREACT, onMsgReact.current);
      msgSocket.off(socketEvent.MSGPINNED, onMsgPinned.current);
      msgSocket.off(socketEvent.MSGDELETE, onMsgDelete.current);
      msgSocket.off(socketEvent.MSGRECALL, onMsgRecall.current);
    };
  }, [msgSocket, call]);
  return <IncomingCallModal />;
};