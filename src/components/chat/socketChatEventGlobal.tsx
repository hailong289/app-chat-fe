"use client";

import { useEffect, useRef } from "react";
import { useSocket } from "../providers/SocketProvider";
import useRoomStore from "@/store/useRoomStore";
import useMessageStore from "@/store/useMessageStore";
import useContactStore from "@/store/useContactStore";
import { socketEvent } from "@/types/socketEvent.type";
import useCallStore from "@/store/useCallStore";
import { useOnlinePresence } from "./hooks/useOnlinePresence";

export const SocketEventChatGlobal = () => {
  const { socket: msgSocket } = useSocket("/chat");
  const { socket: call } = useSocket("/call");
  const roomState = useRoomStore((state) => state);
  const contactState = useContactStore((state) => state);
  const messageState = useMessageStore((state) => state);

  // Enable online presence heartbeat
  useOnlinePresence(msgSocket);

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

  useEffect(() => {
    if (!msgSocket || !call) return;
    // msgSocket.on(socketEvent.ROOMUPSERT, roomState.updateRoomSocket);
    msgSocket.on(socketEvent.MSGUPSERT, messageState.upsetMsg);
    msgSocket.on(socketEvent.MSGMARKREAD, roomState.setRoomReaded);
    msgSocket.on(socketEvent.STATUS, contactState.socketHandleOnline);
    msgSocket.on(socketEvent.ROOMDELETE, roomState.roomDeleteSocket);
    msgSocket.on(socketEvent.ERRORMSG, messageState.upsetMsgError);
    msgSocket.on(socketEvent.STATUSTYPING, roomState.handleTypingEvent);
    call.on(socketEvent.CALL, onCallRequest.current);
    call.on(socketEvent.MSGUPSERT, onMsgUpsertCall.current);
    call.on("call:busy", onCallBusy.current);
    msgSocket.on(socketEvent.ROOM_REFRESH, onRoomRefresh.current);
    return () => {
      call.off(socketEvent.CALL, onCallRequest.current);
      call.off(socketEvent.MSGUPSERT, onMsgUpsertCall.current);
      call.off("call:busy", onCallBusy.current);
      // msgSocket.off(socketEvent.ROOMUPSERT, roomState.updateRoomSocket);
      msgSocket.off(socketEvent.MSGUPSERT, messageState.upsetMsg);
      msgSocket.off(socketEvent.MSGMARKREAD, roomState.setRoomReaded);
      msgSocket.off(socketEvent.STATUS, contactState.socketHandleOnline);
      msgSocket.off(socketEvent.ROOMDELETE, roomState.roomDeleteSocket);
      msgSocket.off(socketEvent.ERRORMSG, messageState.upsetMsgError);
      msgSocket.off(socketEvent.STATUSTYPING, roomState.handleTypingEvent);
      msgSocket.off(socketEvent.ROOM_REFRESH, onRoomRefresh.current);
    };
  }, [msgSocket, call]);
  return <></>;
};
