"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useCallback,
} from "react";
import { io, Socket } from "socket.io-client";
import useAuthStore from "@/store/useAuthStore";
import { getCookie } from "cookies-next";

export type DocSocketStatus =
  | "idle"
  | "connecting"
  | "connected"
  | "disconnected"
  | "error";

type DocSocketCtx = {
  socket: Socket | null;
  status: DocSocketStatus;
  error: string | null;
  reconnect: () => void;
  disconnect: () => void;
};

const DocSocketContext = createContext<DocSocketCtx>({
  socket: null,
  status: "idle",
  error: null,
  reconnect: () => {},
  disconnect: () => {},
});

/**
 * Lấy accessToken từ Zustand store hoặc cookie
 */
function useAccessToken(): string | null {
  const access = useAuthStore((s) => s.tokens?.accessToken ?? null);
  const [fallbackAccess, setFallbackAccess] = useState<string | null>(null);

  useEffect(() => {
    if (access) {
      setFallbackAccess(null);
      return;
    }
    try {
      const raw = getCookie("tokens");
      if (typeof raw === "string" && raw.length > 0) {
        const parsed = JSON.parse(raw);
        if (parsed?.accessToken) {
          setFallbackAccess(parsed.accessToken as string);
        }
      }
    } catch {
      // ignore
    }
  }, [access]);

  return access ?? fallbackAccess;
}

export function DocSocketProvider({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const token = useAccessToken();
  const [status, setStatus] = useState<DocSocketStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [socket, setSocket] = useState<Socket | null>(null);
  const socketRef = useRef<Socket | null>(null);

  const socketUrl =
    process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:3001";

  // Socket options
  const opts = useMemo(
    () => ({
      auth: token ? { token } : undefined,
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 5,
      transports: ["websocket", "polling"],
      timeout: 20000,
      upgrade: true,
      forceNew: false,
      pingInterval: 25000,
      pingTimeout: 20000,
    }),
    [token]
  );

  // Connect/Reconnect function
  const connect = useCallback(() => {
    if (!token) {
      setError("No authentication token found");
      setStatus("error");
      return;
    }

    if (socketRef.current?.connected) {
      return;
    }

    setStatus("connecting");
    setError(null);

    const docNamespaceUrl = `${socketUrl}/doc`;

    const newSocket = io(docNamespaceUrl, opts);

    // Connection events
    newSocket.on("connect", () => {
      setStatus("connected");
      setError(null);
      setSocket(newSocket);
    });

    newSocket.on("disconnect", (reason) => {
      setStatus("disconnected");
    });

    newSocket.on("connect_error", (err) => {
      console.error("❌ Doc socket connect error:", err.message);
      setError(err.message);
      setStatus("error");
    });

    newSocket.on("error", (err: any) => {
      console.error("❌ Doc socket error:", {
        error: err,
        type: typeof err,
        keys: err ? Object.keys(err) : [],
        message: err?.message,
        stack: err?.stack,
      });
      setError(err?.message || err?.error || "Socket error");
      setStatus("error");
    });

    newSocket.on("exception", (data: any) => {
      console.error("❌ Doc socket exception:", {
        data,
        message: data?.message,
        statusCode: data?.statusCode,
      });
      setError(data?.message || "Connection error");
      // Don't set status to error for exceptions - they might be recoverable
    });

    newSocket.on("connected", (data: any) => {});

    socketRef.current = newSocket;
    setSocket(newSocket);
  }, [token, socketUrl, opts]);

  // Disconnect function
  const disconnect = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
      setSocket(null);
      setStatus("disconnected");
    }
  }, []);

  // Auto-connect when token is available
  useEffect(() => {
    if (token) {
      connect();
    } else {
      disconnect();
    }

    return () => {
      disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, socketUrl, opts]);

  const value = useMemo(
    () => ({
      socket,
      status,
      error,
      reconnect: connect,
      disconnect,
    }),
    [socket, status, error]
  );

  return (
    <DocSocketContext.Provider value={value}>
      {children}
    </DocSocketContext.Provider>
  );
}

/**
 * Hook để sử dụng Doc Socket Context
 */
export function useDocSocket(): DocSocketCtx {
  const context = useContext(DocSocketContext);
  if (!context) {
    throw new Error("useDocSocket must be used within DocSocketProvider");
  }
  return context;
}
