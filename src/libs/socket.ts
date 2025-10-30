// src/lib/socket.ts
import { io, Socket } from "socket.io-client";

export type SocketAuthProvider = () => Promise<string | null> | string | null;

let _socket: Socket | null = null;

type CreateSocketOptions = {
  url: string;
  getToken?: SocketAuthProvider; // gọi mỗi lần connect/reconnect
  namespace?: string; // ví dụ: "/chat"
  query?: Record<string, string | number | boolean>;
};

export const createBrowserSocket = async (
  opts: CreateSocketOptions
): Promise<Socket> => {
  if (typeof window === "undefined") {
    throw new Error("Socket can only be created in the browser");
  }
  if (_socket && _socket.connected) return _socket;

  const { url, getToken, namespace, query } = opts;

  // Build namespace URL correctly
  // If url already includes namespace, don't append again
  let nsUrl = url.replace(/\/$/, ""); // Remove trailing slash

  if (namespace && !url.endsWith(namespace)) {
    nsUrl = `${nsUrl}${namespace}`;
  }

  console.log("🔌 [Socket] Final URL:", nsUrl);

  const token = getToken ? await getToken() : null;
  console.log("🔌 [Socket] Auth token:", token ? "✅ Present" : "❌ Missing");

  // Gửi token qua cả extraHeaders, auth và query để tương thích với nhiều backend
  const socketOptions: any = {
    transports: ["websocket"], // ưu tiên ws
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 500, // backoff ms
    reconnectionDelayMax: 8000,
    timeout: 10000,
    autoConnect: true,
    forceNew: false,
    withCredentials: true,
    query: query ?? {},
  };

  // Thêm token vào 3 nơi như backend expect
  if (token) {
    // 1. auth.token
    socketOptions.auth = {
      token: token,
    };
    // 2. query.token
    socketOptions.query = {
      ...socketOptions.query,
      token: token,
    };
    // 3. headers.authorization (raw token, không có "Bearer")
    socketOptions.extraHeaders = {
      authorization: token,
    };
  }

  _socket = io(nsUrl, socketOptions);

  console.log("🔌 [Socket] Socket.io options:", {
    url: nsUrl,
    transports: ["websocket"],
    auth: token ? { token: "<present>" } : undefined,
    query: token ? { ...query, token: "<present>" } : query,
    extraHeaders: token ? { authorization: "<token>" } : undefined,
  });

  return _socket;
};

export const getSocket = () => _socket;
export const destroySocket = () => {
  if (_socket) {
    _socket.removeAllListeners();
    _socket.disconnect();
    _socket = null;
  }
};
