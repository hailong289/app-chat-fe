// lib/socket.ts
"use client";

import { io, Socket } from "socket.io-client";

let socket: Socket | null = null;

export function getSocket() {
  if (!socket) {
    socket = io(
      process.env.NEXT_PUBLIC_SOCKET_DOC_URL ?? "http://localhost:3000",
      {
        transports: ["websocket"],
        // auth: { token: "JWT..." }, // nếu cần
      }
    );
  }
  return socket;
}
