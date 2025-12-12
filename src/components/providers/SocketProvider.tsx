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

export type SocketStatus =
  | "idle"
  | "connecting"
  | "connected"
  | "reconnecting"
  | "error";

type SocketCtx = {
  socket: Socket | null;
  status: SocketStatus;
  reconnectCount: number;
  lastError: string | null;
  forceReconnect: () => void;
  disconnect: () => void;
};

const Ctx = createContext<SocketCtx>({
  socket: null,
  status: "idle",
  reconnectCount: 0,
  lastError: null,
  forceReconnect: () => {},
  disconnect: () => {},
});

/**
 * Tạo hoặc lấy client ID duy nhất cho sticky session
 * Giúp load balancer route về đúng server instance
 */
function getOrCreateClientId(): string {
  if (globalThis.window === undefined) return "";

  const key = "chat_client_id";
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
 * Lấy accessToken:
 * - Ưu tiên từ Zustand store
 * - Fallback từ cookie "tokens" (JSON) khi mới reload (rehydration chưa xong)
 */
function useAccessToken(): string | null {
  const access = useAuthStore((s) => s.tokens?.accessToken ?? null);
  const [fallbackAccess, setFallbackAccess] = useState<string | null>(null);

  useEffect(() => {
    if (access) {
      setFallbackAccess(null);
      return;
    }
    // chỉ đọc cookie một lần khi không có token trong store
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

export function SocketProvider({
  children,
  url,
}: Readonly<{ children: React.ReactNode; url?: string }>) {
  const token = useAccessToken();
  const [status, setStatus] = useState<SocketStatus>("idle");
  const [reconnectCount, setReconnectCount] = useState(0);
  const [lastError, setLastError] = useState<string | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const reconnectTimerRef = useRef<NodeJS.Timeout | null>(null);

  url = url || process.env.NEXT_PUBLIC_SOCKET_URL!;

  // Enhanced socket options for Auto Scaling environments
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
      // Gửi heartbeat để giữ connection alive qua load balancer
      pingInterval: 25000,
      pingTimeout: 60000,
      // Custom query params có thể dùng cho sticky session
      query: {
        clientId: getOrCreateClientId(),
        version: "1.0.0",
      },
    }),
    [token]
  );

  // Force reconnect function
  const forceReconnect = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current.connect();
    }
  }, []);

  // Disconnect function - sử dụng khi logout
  const disconnect = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }
    setStatus("idle");
    setReconnectCount(0);
    setLastError(null);
  }, []);

  useEffect(() => {
    // Cleanup timer on unmount
    return () => {
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    // Mỗi lần token đổi (login/logout), ngắt kết nối cũ & kết nối lại nếu có token
    socketRef.current?.disconnect();
    socketRef.current = null;

    if (!token) {
      setStatus("idle");
      setReconnectCount(0);
      setLastError(null);
      return;
    }

    setStatus("connecting");
    const namespaceUrl = url.endsWith("/chat") ? url : `${url}/chat`;
    const s = io(namespaceUrl, opts);

    s.on("connect", () => {
      setStatus("connected");
      setReconnectCount(0);
      setLastError(null);

      // Log server instance info (if provided by backend)
      s.emit("client:info", {
        clientId: getOrCreateClientId(),
        userAgent:
          typeof navigator === "undefined" ? "Unknown" : navigator.userAgent,
        timestamp: Date.now(),
      });
    });

    s.on("disconnect", (reason) => {
      // Different handling based on disconnect reason
      if (reason === "io server disconnect") {
        // Server intentionally disconnected, need manual reconnect
        setStatus("reconnecting");
        reconnectTimerRef.current = setTimeout(() => {
          s.connect();
        }, 2000);
      } else if (reason === "transport close" || reason === "ping timeout") {
        // Network issue or timeout, auto reconnect will handle
        setStatus("reconnecting");
      } else {
        setStatus("idle");
      }
    });

    // Transport upgrade (polling -> websocket)
    s.io.engine.on("upgrade", (transport: any) => {});

    s.io.on("reconnect_attempt", (attempt) => {
      setStatus("reconnecting");
      setReconnectCount(attempt);
    });

    s.io.on("reconnect", (attempt) => {
      setStatus("connected");
      setReconnectCount(0);
      setLastError(null);
    });

    s.io.on("reconnect_error", (err) => {
      console.error("💥 [Socket] Reconnect error:", err.message);
      setLastError(err.message);
    });

    s.io.on("reconnect_failed", () => {
      console.error("❌ [Socket] Reconnect failed after all attempts");
      setStatus("error");
      setLastError("Reconnection failed after all attempts");
    });

    s.on("connect_error", (err: any) => {
      console.error("💥 [Socket] Connect error:", err.message);
      setLastError(err.message);

      // Nếu server trả unauthorized, đừng spam reconnect vô nghĩa
      const msg = String(err?.message || "").toLowerCase();
      if (
        msg.includes("unauthorized") ||
        msg.includes("jwt") ||
        msg.includes("forbidden") ||
        err?.code === 401
      ) {
        setStatus("error");
        setLastError("Authentication failed. Please login again.");
        // Ngắt hẳn; user cần login lại để có token mới
        s.disconnect();
        return;
      }
      setStatus("error");
    });

    // Handle server scaling events
    s.on("server:scaling", (data: any) => {
      // Backend có thể emit event này khi scaling
      // Client có thể prepare cho disconnect/reconnect
    });

    s.on("server:maintenance", (data: any) => {
      // Graceful disconnect when server going to maintenance
    });

    socketRef.current = s;

    return () => {
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
      }
      s.disconnect();
      socketRef.current = null;
    };
  }, [url, opts, token, forceReconnect]);

  const value = useMemo<SocketCtx>(
    () => ({
      socket: socketRef.current,
      status,
      reconnectCount,
      lastError,
      forceReconnect,
      disconnect,
    }),
    [status, reconnectCount, lastError, forceReconnect, disconnect]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useSocket = () => useContext(Ctx);
