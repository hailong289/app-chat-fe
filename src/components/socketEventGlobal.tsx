"use client";

import { useEffect } from "react";
import { useSocket } from "./providers/SocketProvider";
import useRoomStore from "@/store/useRoomStore";
import useMessageStore from "@/store/useMessageStore";

export const SocketEventGlobal = () => {
  const { socket, status } = useSocket();
  const roomState = useRoomStore((state) => state);
  const messageState = useMessageStore((state) => state);
  useEffect(() => {
    if (!socket) return;
    console.log("nhận xử lý socket");
    socket.on("room:upset", roomState.updateRoomSocket);
    socket.on("message:upset", messageState.upsetMsg);
    socket.on("mark:read", roomState.setRoomReaded);
    return () => {
      socket.off("room:upset", roomState.updateRoomSocket);
      socket.off("message:upset", messageState.upsetMsg);
      socket.off("mark:read", roomState.setRoomReaded);
    };
  }, [socket]);
  return <></>;
};
