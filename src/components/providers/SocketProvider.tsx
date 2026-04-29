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
import { subscribeTokenRefresh } from "@/libs/tokenRefresh";

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
  // Read from the in-memory Zustand store (mirrored to
  // localStorage["accessToken"] by tokenStorage). The cookie used to
  // hold the access token but post-refactor it's HttpOnly + only
  // contains the refresh token scoped to /auth — JS can't read it,
  // and even if it could, it doesn't carry the access token anymore.
  try {
    return useAuthStore.getState().tokens?.accessToken ?? null;
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
  // Fix: `tokens` is an object literal (with null fields when logged out),
  // so `!s.tokens` is ALWAYS false (object is truthy). Subscribe to the
  // actual access token instead so the connect-on-login effect fires
  // when login flips it from null → real value.
  const accessToken = useAuthStore((s) => s.tokens?.accessToken ?? null);
  const isLoggedOut = !accessToken;

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

  /* ========= 1️⃣ INIT SOCKET (mount + post-login) =========
   *
   * Re-runs when `accessToken` changes so sockets are (re-)created
   * after login. Without `accessToken` in deps, the logout flow's
   * `disconnectAll()` empties `socketsRef.current` and the next
   * login can never reach the "Token Ready → connect" effect because
   * the socket map stays empty until a full page reload. The
   * `if (socketsRef.current[ns]) return` guard inside the loop keeps
   * this idempotent — refresh-token rotations don't recreate live
   * sockets, only the post-logout-empty case kicks in.
   */
  useEffect(() => {
    if (!accessToken) return; // logged out → don't create sockets
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
        // Empty {} errors are benign internal Socket.IO/NestJS noise — skip them
        if (
          err !== null &&
          typeof err === "object" &&
          !(err instanceof Error) &&
          Object.keys(err).length === 0 &&
          Object.getOwnPropertyNames(err).length === 0
        ) {
          console.warn(`⚠️ [${ns}] Socket Error (empty — ignored):`, err);
          return;
        }

        let msg = "Socket error";

        if (err instanceof Error) {
          msg = err.message;
        } else if (typeof err === "string") {
          msg = err;
        } else if (err && typeof err === "object") {
          try {
            msg = JSON.stringify(err);
            if (msg === "{}") {
              const props = Object.getOwnPropertyNames(err);
              msg =
                props.length > 0
                  ? JSON.stringify(
                      Object.fromEntries(props.map((p) => [p, (err as any)[p]])),
                    )
                  : "Unknown error";
            }
          } catch {
            msg = "Non-serializable error";
          }
        }

        console.error(`❌ [${ns}] Socket Error:`, msg);

        const lowerMsg = msg.toLowerCase();
        if (
          lowerMsg.includes("unauthorized") ||
          lowerMsg.includes("jwt") ||
          lowerMsg.includes("forbidden")
        ) {
          console.warn(
            `🔒 [${ns}] Auth failed (error event), stopping reconnect.`,
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
  }, [namespaces, baseUrl, updateState, accessToken]);

  /* ========= 2️⃣ TOKEN READY → CONNECT / RECONNECT ALL ========= */
  // Re-runs when `accessToken` changes (login, refresh, logout). Replaces
  // the old `isLoggedOut`-only dep which never flipped because `tokens`
  // was always a truthy object literal.
  useEffect(() => {
    const token = accessToken || getAccessToken();
    if (!token) return;

    Object.entries(socketsRef.current).forEach(([ns, socket]) => {
      socket.auth = { token };
      if (!socket.connected) {
        updateState(ns, { status: "connecting" });
        socket.connect();
      }
    });
  }, [accessToken, updateState]);

  /* ========= 2b️⃣ TOKEN REFRESHED → RE-HANDSHAKE SOCKETS ========= */
  // When the access token rotates (refresh succeeded), the Socket.IO
  // session is still using the OLD token. The BE eventually rejects the
  // next auth-protected event with "Unauthorized" → infinite reconnect
  // loop. Force a clean disconnect+reconnect with the new token.
  //
  // Triggered via the singleton in libs/tokenRefresh, NOT a Zustand
  // selector — because the Zustand `accessToken` selector above also
  // fires on the change, but THIS handler must run AFTER the cookie has
  // been written (subscribers are notified post-write).
  useEffect(() => {
    const unsubscribe = subscribeTokenRefresh((newToken) => {
      if (!newToken) {
        // Refresh failed — disconnect everything; the logout flow will
        // tear sockets down via isLoggedOut on next render too.
        Object.values(socketsRef.current).forEach((s) => s.disconnect());
        return;
      }
      Object.entries(socketsRef.current).forEach(([ns, socket]) => {
        socket.auth = { token: newToken };
        if (socket.connected) {
          // Force a fresh handshake. socket.connect() alone wouldn't
          // re-send auth on an already-open connection.
          socket.disconnect();
        }
        updateState(ns, { status: "connecting" });
        socket.connect();
      });
    });
    return unsubscribe;
  }, [updateState]);

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
