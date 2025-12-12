"use client";
import { useEffect, useState } from "react";
import { io, Socket } from "socket.io-client";

interface DocSocketContext {
  socket: Socket | null;
  status: "connected" | "disconnected" | "connecting";
  error: string | null;
}

export function useDocSocket(): DocSocketContext {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [status, setStatus] = useState<
    "connected" | "disconnected" | "connecting"
  >("disconnected");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Lấy token từ localStorage
    const token =
      globalThis.window && globalThis.window !== undefined
        ? localStorage.getItem("token")
        : null;

    if (!token) {
      setError("No authentication token found");
      return;
    }

    setStatus("connecting");

    // Kết nối đến namespace /doc riêng biệt từ chat
    const socketUrl =
      process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:3001";
    // Append namespace to the URL
    const docNamespaceUrl = `${socketUrl}/doc`;
    const newSocket = io(docNamespaceUrl, {
      auth: {
        token,
      },
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 5,
      transports: ["websocket", "polling"],
    });

    // Connection events
    newSocket.on("connect", () => {
      setStatus("connected");
      setError(null);
    });

    newSocket.on("disconnect", () => {
      setStatus("disconnected");
    });

    newSocket.on("connected", (data: any) => {
      console.log("✅ Doc socket connected:", data);
    });

    newSocket.on("exception", (data: any) => {
      setError(data?.message || "Connection error");
      console.error("❌ Doc socket exception:", data);
    });

    newSocket.on("error", (error: any) => {
      setError(error?.message || "Socket error");
      console.error("❌ Doc socket error:", error);
    });

    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  }, []);

  return { socket, status, error };
}
