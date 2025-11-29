"use client";

import { useEffect } from "react";
import { useSocket } from "./providers/SocketProvider";
import useRoomStore from "@/store/useRoomStore";
import useMessageStore from "@/store/useMessageStore";
import useContactStore from "@/store/useContactStore";

export const SocketEventGlobal = () => {
  const { socket } = useSocket();
  const roomState = useRoomStore((state) => state);
  const contactState = useContactStore((state) => state);
  const messageState = useMessageStore((state) => state);
  useEffect(() => {
    if (!socket) return;
    console.log("nhận xử lý socket");
    socket.on("room:upset", roomState.updateRoomSocket);
    socket.on("message:upset", messageState.upsetMsg);
    socket.on("mark:readed", roomState.setRoomReaded);
    socket.on("status:online", contactState.socketHandleOnline);
    socket.on("room:delete", roomState.roomDeleteSocket);
    socket.on("error:message", messageState.upsetMsgError);
    return () => {
      socket.off("room:upset", roomState.updateRoomSocket);
      socket.off("message:upset", messageState.upsetMsg);
      socket.off("mark:readed", roomState.setRoomReaded);
      socket.off("status:online", contactState.socketHandleOnline);
      socket.off("room:delete", roomState.roomDeleteSocket);
      socket.off("error:message", messageState.upsetMsgError);
    };
  }, [socket]);
  return <></>;
};
