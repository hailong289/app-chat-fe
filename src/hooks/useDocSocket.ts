import { useSocket } from "@/components/providers/SocketProvider";
import { Socket } from "socket.io-client";

export type DocSocketStatus =
  | "idle"
  | "connecting"
  | "connected"
  | "disconnected"
  | "reconnecting"
  | "error";

export function useDocSocket() {
  const {
    socket,
    status,
    lastError,
    reconnectCount,
    forceReconnect,
    disconnect,
  } = useSocket("/doc");

  return {
    socket: socket || null,
    status: status as DocSocketStatus,
    error: lastError,
    reconnectCount,
    reconnect: forceReconnect,
    disconnect,
  };
}
