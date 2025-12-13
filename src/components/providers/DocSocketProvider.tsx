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
  | "reconnecting"
  | "error";

type DocSocketCtx = {
  socket: Socket | null;
  status: DocSocketStatus;
  error: string | null;
  reconnectCount: number;
  reconnect: () => void;
  disconnect: () => void;
};

const DocSocketContext = createContext<DocSocketCtx>({
  socket: null,
  status: "idle",
  error: null,
  reconnectCount: 0,
  reconnect: () => {},
  disconnect: () => {},
});

/**
 * Tạo hoặc lấy client ID duy nhất cho sticky session
 * Giúp load balancer route về đúng server instance
 */
function getOrCreateClientId(): string {
  if (globalThis.window === undefined) return "";

  const key = "doc_client_id";
  let clientId = localStorage.getItem(key);

  if (!clientId) {
    clientId = `client_${Date.now()}_${Math.random()
      .toString(36)
      .substring(2, 9)}`;
    localStorage.setItem(key, clientId);
  }

  return clientId;
}

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
      console.log("🚀 ~ useAccessToken ~ raw:", raw);
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
  const [reconnectCount, setReconnectCount] = useState(0);
  const socketRef = useRef<Socket | null>(null);
  const reconnectTimerRef = useRef<NodeJS.Timeout | null>(null);

  const socketUrl =
    process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:3001";

  // Socket options
  const opts = useMemo(
    () => ({
      transports: ["websocket", "polling"], // Fallback to polling if websocket fails
      auth: token ? { token } : undefined,
      reconnection: true,
      reconnectionAttempts: Infinity, // Thử reconnect vô hạn
      reconnectionDelay: 1000, // Delay ban đầu 1s
      reconnectionDelayMax: 10000, // Tối đa 10s giữa các lần thử
      timeout: 20_000, // Tăng timeout cho load balancer
      // Cho phép upgrade từ polling lên websocket
      upgrade: true,
      // Quan trọng cho Auto Scaling: enable sticky session
      forceNew: false,
      multiplex: true,
      // Gửi heartbeat để giữ connection alive qua load balancer
      pingInterval: 25000,
      pingTimeout: 60000,
      // Custom query params có thể dùng cho sticky session
      query: {
        clientId: getOrCreateClientId(),
        version: "1.1.0",
      },
    }),
    [token]
  );

  // Connect/Reconnect function
  const connect = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current.connect();
    }
  }, []);

  // Disconnect function
  const disconnect = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
      setSocket(null);
      setStatus("disconnected");
      setReconnectCount(0);
      setError(null);
    }
  }, []);

  useEffect(() => {
    // Cleanup timer on unmount
    return () => {
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
      }
    };
  }, []);

  // Auto-connect when token is available
  useEffect(() => {
    // Mỗi lần token đổi (login/logout), ngắt kết nối cũ & kết nối lại nếu có token
    socketRef.current?.disconnect();
    socketRef.current = null;

    if (!token) {
      setStatus("idle");
      setReconnectCount(0);
      setError(null);
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
      setReconnectCount(0);

      // Log server instance info (if provided by backend)
      newSocket.emit("client:info", {
        clientId: getOrCreateClientId(),
        userAgent:
          typeof navigator === "undefined" ? "Unknown" : navigator.userAgent,
        timestamp: Date.now(),
      });
    });

    newSocket.on("disconnect", (reason) => {
      // Different handling based on disconnect reason
      if (reason === "io server disconnect") {
        // Server intentionally disconnected, need manual reconnect
        setStatus("reconnecting");
        reconnectTimerRef.current = setTimeout(() => {
          newSocket.connect();
        }, 2000);
      } else if (reason === "transport close" || reason === "ping timeout") {
        // Network issue or timeout, auto reconnect will handle
        setStatus("reconnecting");
      } else {
        setStatus("disconnected");
      }
    });

    newSocket.io.on("reconnect_attempt", (attempt) => {
      setStatus("reconnecting");
      setReconnectCount(attempt);
    });

    newSocket.io.on("reconnect", (attempt) => {
      setStatus("connected");
      setReconnectCount(0);
      setError(null);
    });

    newSocket.io.on("reconnect_error", (err) => {
      console.error("💥 [DocSocket] Reconnect error:", err.message);
      setError(err.message);
    });

    newSocket.io.on("reconnect_failed", () => {
      console.error("❌ [DocSocket] Reconnect failed after all attempts");
      setStatus("error");
      setError("Reconnection failed after all attempts");
    });

    newSocket.on("connect_error", (err) => {
      console.error("❌ Doc Socket Connect Error Details:", {
        message: err.message,
        name: err.name,
        // @ts-ignore - Đôi khi server trả thêm data
        data: err.data,
        stack: err.stack,
      });
      setError(err.message);

      // Nếu server trả unauthorized, đừng spam reconnect vô nghĩa
      const msg = String(err?.message || "").toLowerCase();
      if (
        msg.includes("unauthorized") ||
        msg.includes("jwt") ||
        msg.includes("forbidden") ||
        (err as any)?.code === 401
      ) {
        setStatus("error");
        setError("Authentication failed. Please login again.");
        // Ngắt hẳn; user cần login lại để có token mới
        newSocket.disconnect();
        return;
      }
      setStatus("error");
    });

    newSocket.on("error", (err: any) => {
      console.error("❌ Doc socket error:", err);
      let msg = "Socket error";
      if (err instanceof Error) msg = err.message;
      else if (typeof err === "string") msg = err;
      else if (err?.message) msg = err.message;
      else if (err?.error) msg = err.error;

      setError(msg);
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

    socketRef.current = newSocket;
    setSocket(newSocket);

    return () => {
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
      }
      newSocket.disconnect();
      socketRef.current = null;
    };
  }, [token, socketUrl, opts]);

  const value = useMemo(
    () => ({
      socket,
      status,
      error,
      reconnectCount,
      reconnect: connect,
      disconnect,
    }),
    [socket, status, error, reconnectCount, connect, disconnect]
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
