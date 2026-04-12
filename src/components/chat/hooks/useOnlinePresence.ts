import { useEffect } from "react";
import { Socket } from "socket.io-client";

export const useOnlinePresence = (socket: Socket | null) => {
  useEffect(() => {
    if (!socket) return;

    // Send initial heartbeat
    socket.emit("heartbeat");

    // Send heartbeat every 15 seconds
    const intervalId = setInterval(() => {
      if (socket.connected) {
        socket.emit("heartbeat");
      }
    }, 15000);

    return () => {
      clearInterval(intervalId);
    };
  }, [socket]);
};
