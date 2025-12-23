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
import { getCookie } from "cookies-next";
import useAuthStore from "@/store/useAuthStore";

/* ================= TYPES ================= */

export type SocketStatus =
  | "idle"
  | "connecting"
  | "connected"
  | "reconnecting"
  | "error";

interface SocketDetailState {
  status: SocketStatus;
  lastError: string | null;
  reconnectCount: number;
}

interface SocketContextValue {
  sockets: Record<string, Socket>;
  socketStates: Record<string, SocketDetailState>;
  disconnectAll: () => void;
}

const SocketContext = createContext<SocketContextValue | null>(null);

/* ================= HELPERS ================= */

function normalizeNs(ns: string) {
  return ns.startsWith("/") ? ns : `/${ns}`;
}

function getAccessToken(): string | null {
  try {
    const raw = getCookie("tokens");
    if (!raw) return null;
    const data = typeof raw === "string" ? JSON.parse(raw) : raw;
    return data?.accessToken ?? null;
  } catch {
    return null;
  }
}

function getOrCreateClientId(namespace: string) {
  const key = `socket_cid_${namespace.replace(/\//g, "_")}`;
  if (typeof window === "undefined") return "";

  let id = localStorage.getItem(key);
  if (!id) {
    id = `cid_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    localStorage.setItem(key, id);
  }
  return id;
}

/* ================= PROVIDER ================= */

export function SocketProvider({
  children,
  namespaces,
  url,
}: Readonly<{
  children: React.ReactNode;
  namespaces: string[];
  url?: string;
}>) {
  const baseUrl = url || process.env.NEXT_PUBLIC_SOCKET_URL!;
  console.log("🚀 ~ SocketProvider ~ baseUrl:", baseUrl);
  const isLoggedOut = useAuthStore((s) => !s.tokens);

  const socketsRef = useRef<Record<string, Socket>>({});
  const [socketStates, setSocketStates] = useState<
    Record<string, SocketDetailState>
  >({});

  const updateState = useCallback(
    (ns: string, patch: Partial<SocketDetailState>) => {
      setSocketStates((prev) => ({
        ...prev,
        [ns]: {
          ...prev[ns],
          ...patch,
        },
      }));
    },
    []
  );

  /* ========= 1️⃣ INIT SOCKET NGAY KHI MOUNT ========= */
  useEffect(() => {
    namespaces.forEach((rawNs) => {
      const ns = normalizeNs(rawNs);
      if (socketsRef.current[ns]) return;

      const socket = io(`${baseUrl}${ns}`, {
        transports: ["websocket", "polling"],
        autoConnect: false,
        auth: { token: getAccessToken() },
        query: {
          clientId: getOrCreateClientId(ns),
          version: "1.1.0",
        },
        reconnection: true,
        reconnectionAttempts: Infinity,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 10000,
        timeout: 20000,
        upgrade: true,
        forceNew: false,
        multiplex: true,
      });

      socket.on("connect", () => {
        updateState(ns, {
          status: "connected",
          lastError: null,
          reconnectCount: 0,
        });

        // Log server instance info
        socket.emit("client:info", {
          clientId: getOrCreateClientId(ns),
          userAgent:
            typeof navigator === "undefined" ? "Unknown" : navigator.userAgent,
          timestamp: Date.now(),
        });
      });

      socket.on("disconnect", (reason) => {
        console.warn(`⚠️ [${ns}] Disconnected:`, reason);
        updateState(ns, {
          status: reason === "io server disconnect" ? "idle" : "reconnecting",
        });
      });

      socket.on("connect_error", (err) => {
        console.error(`❌ [${ns}] Connect Error:`, err.message);
        const msg = err?.message || "Connection error";

        // Check for auth errors to prevent infinite reconnect loops
        const lowerMsg = msg.toLowerCase();
        if (
          lowerMsg.includes("unauthorized") ||
          lowerMsg.includes("jwt") ||
          lowerMsg.includes("forbidden")
        ) {
          console.warn(`🔒 [${ns}] Auth failed, stopping reconnect.`);
          socket.disconnect();
        }

        updateState(ns, {
          status: "error",
          lastError: msg,
        });
      });

      socket.on("error", (err: any) => {
        console.error(`❌ [${ns}] Socket Error Raw:`, err);
        let msg = "Socket error";

        if (err instanceof Error) {
          msg = err.message;
        } else if (typeof err === "string") {
          msg = err;
        } else if (err && typeof err === "object") {
          try {
            msg = JSON.stringify(err);
            if (msg === "{}") {
              // Try getting own property names if it's a custom error object
              const props = Object.getOwnPropertyNames(err);
              if (props.length > 0) {
                const obj: any = {};
                props.forEach((p) => (obj[p] = (err as any)[p]));
                msg = JSON.stringify(obj);
              } else {
                msg = "Unknown error object (empty)";
              }
            }
          } catch {
            msg = "Non-serializable error";
          }
        }

        console.error(`❌ [${ns}] Socket Error Parsed:`, msg);

        const lowerMsg = msg.toLowerCase();
        if (
          lowerMsg.includes("unauthorized") ||
          lowerMsg.includes("jwt") ||
          lowerMsg.includes("forbidden")
        ) {
          console.warn(
            `🔒 [${ns}] Auth failed (error event), stopping reconnect.`
          );
          socket.disconnect();
        }

        updateState(ns, {
          status: "error",
          lastError: msg,
        });
      });

      socket.io.on("reconnect_attempt", (attempt) => {
        updateState(ns, {
          status: "reconnecting",
          reconnectCount: attempt,
        });
      });

      socket.io.on("reconnect_error", (err) => {
        console.error(`💥 [${ns}] Reconnect error:`, err.message);
      });

      socketsRef.current[ns] = socket;
      updateState(ns, { status: "idle" });
    });
  }, [namespaces, baseUrl, updateState]);

  /* ========= 2️⃣ TOKEN READY → CONNECT ALL ========= */
  useEffect(() => {
    const token = getAccessToken();
    if (!token) return;

    Object.entries(socketsRef.current).forEach(([ns, socket]) => {
      socket.auth = { token };
      if (!socket.connected) {
        updateState(ns, { status: "connecting" });
        socket.connect();
      }
    });
  }, [isLoggedOut, updateState]);

  /* ========= 3️⃣ LOGOUT → DISCONNECT ========= */
  const disconnectAll = useCallback(() => {
    Object.values(socketsRef.current).forEach((s) => {
      s.removeAllListeners();
      s.disconnect();
    });
    socketsRef.current = {};
    setSocketStates({});
  }, []);

  useEffect(() => {
    if (isLoggedOut) disconnectAll();
  }, [isLoggedOut, disconnectAll]);

  const value = useMemo(
    () => ({
      sockets: socketsRef.current,
      socketStates,
      disconnectAll,
    }),
    [socketStates, disconnectAll]
  );

  return (
    <SocketContext.Provider value={value}>{children}</SocketContext.Provider>
  );
}

/* ================= HOOK ================= */

export function useSocket(namespace: string = "/") {
  const ctx = useContext(SocketContext);
  if (!ctx) throw new Error("useSocket must be used inside SocketProvider");

  const ns = normalizeNs(namespace);
  const socket = ctx.sockets[ns];

  const currentState = ctx.socketStates[ns] || {
    status: "idle",
    lastError: null,
    reconnectCount: 0,
  };

  const connect = useCallback(() => {
    if (!socket) return;
    if (!socket.connected && getAccessToken()) {
      socket.connect();
    }
  }, [socket]);

  const disconnect = useCallback(() => {
    if (socket?.connected) socket.disconnect();
  }, [socket]);

  const forceReconnect = useCallback(() => {
    if (!socket) return;
    socket.disconnect();
    if (getAccessToken()) socket.connect();
  }, [socket]);

  return {
    socket,
    status: currentState.status,
    isConnected: currentState.status === "connected",
    lastError: currentState.lastError,
    reconnectCount: currentState.reconnectCount,
    connect,
    disconnect,
    forceReconnect,
  };
}
