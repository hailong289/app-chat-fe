"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { io, Socket } from "socket.io-client";
import useAuthStore from "@/store/useAuthStore";
import { getCookie } from "cookies-next";

export type SocketStatus = "idle" | "connecting" | "connected" | "error";

type SocketCtx = {
  socket: Socket | null;
  status: SocketStatus;
};

const Ctx = createContext<SocketCtx>({ socket: null, status: "idle" });

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

export function SocketProvider({ children }: { children: React.ReactNode }) {
  const token = useAccessToken();
  const [status, setStatus] = useState<SocketStatus>("idle");
  const socketRef = useRef<Socket | null>(null);

  const url = process.env.NEXT_PUBLIC_SOCKET_URL!;
  // Bạn có thể thay đổi transports tuỳ hạ tầng (mặc định ưu tiên websocket)
  const opts = useMemo(
    () => ({
      transports: ["websocket"],
      auth: token ? { token } : undefined,
      reconnection: true,
      reconnectionAttempts: Infinity, // Thử reconnect vô hạn
      reconnectionDelay: 1000, // Delay ban đầu 1s
      reconnectionDelayMax: 10000, // Tối đa 10s giữa các lần thử
      timeout: 10_000,
    }),
    [token]
  );

  useEffect(() => {
    // Mỗi lần token đổi (login/logout), ngắt kết nối cũ & kết nối lại nếu có token
    socketRef.current?.disconnect();
    socketRef.current = null;

    if (!token) {
      setStatus("idle");
      return;
    }

    setStatus("connecting");
    const s = io(url, opts);

    s.on("connect", () => {
      console.log("✅ [Socket] Connected! ID:", s.id);
      setStatus("connected");
    });

    s.on("disconnect", (reason) => {
      console.log("❌ [Socket] Disconnected. Reason:", reason);
      setStatus("idle");
    });

    s.io.on("reconnect_attempt", (attempt) => {
      console.log(`🔄 [Socket] Reconnect attempt #${attempt}...`);
    });

    s.io.on("reconnect", (attempt) => {
      console.log(`✅ [Socket] Reconnected after ${attempt} attempts`);
    });

    s.io.on("reconnect_error", (err) => {
      console.error("💥 [Socket] Reconnect error:", err.message);
    });

    s.io.on("reconnect_failed", () => {
      console.error("❌ [Socket] Reconnect failed after all attempts");
    });

    s.on("connect_error", (err: any) => {
      // Nếu server trả unauthorized, đừng spam reconnect vô nghĩa
      const msg = String(err?.message || "").toLowerCase();
      if (
        msg.includes("unauthorized") ||
        msg.includes("jwt") ||
        msg.includes("forbidden") ||
        err?.code === 401
      ) {
        setStatus("error");
        // Ngắt hẳn; user cần login lại để có token mới
        s.disconnect();
        return;
      }
      setStatus("error");
    });

    socketRef.current = s;

    return () => {
      s.disconnect();
      socketRef.current = null;
    };
  }, [url, opts, token]);

  const value = useMemo<SocketCtx>(
    () => ({ socket: socketRef.current, status }),
    [status]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useSocket = () => useContext(Ctx);
