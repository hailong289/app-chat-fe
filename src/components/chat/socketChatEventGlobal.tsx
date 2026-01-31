"use client";

import { useEffect } from "react";
import { useSocket } from "../providers/SocketProvider";
import useRoomStore from "@/store/useRoomStore";
import useMessageStore from "@/store/useMessageStore";
import useContactStore from "@/store/useContactStore";
import { socketEvent } from "@/types/socketEvent.type";
import useCallStore from "@/store/useCallStore";

export const SocketEventChatGlobal = () => {
  const { socket } = useSocket("/chat");
  const roomState = useRoomStore((state) => state);
  const contactState = useContactStore((state) => state);
  const messageState = useMessageStore((state) => state);
  const callStore = useCallStore((state) => state);
  useEffect(() => {
    if (!socket) return;
    // socket.on(socketEvent.ROOMUPSERT, roomState.updateRoomSocket);
    socket.on(socketEvent.MSGUPSERT, messageState.upsetMsg);
    socket.on(socketEvent.MSGMARKREAD, roomState.setRoomReaded);
    socket.on(socketEvent.STATUS, contactState.socketHandleOnline);
    socket.on(socketEvent.ROOMDELETE, roomState.roomDeleteSocket);
    socket.on(socketEvent.ERRORMSG, messageState.upsetMsgError);
    socket.on(socketEvent.STATUSTYPING, roomState.handleTypingEvent);
    socket.on(socketEvent.CALL, (payload: any) => callStore.eventCall("request", payload));
    return () => {
      socket.off(socketEvent.CALL, (payload: any) => callStore.eventCall("request", payload));
      // socket.off(socketEvent.ROOMUPSERT, roomState.updateRoomSocket);
      socket.off(socketEvent.MSGUPSERT, messageState.upsetMsg);
      socket.off(socketEvent.MSGMARKREAD, roomState.setRoomReaded);
      socket.off(socketEvent.STATUS, contactState.socketHandleOnline);
      socket.off(socketEvent.ROOMDELETE, roomState.roomDeleteSocket);
      socket.off(socketEvent.ERRORMSG, messageState.upsetMsgError);
      socket.off(socketEvent.STATUSTYPING, roomState.handleTypingEvent);
    };
  }, [socket]);
  return <></>;
};
