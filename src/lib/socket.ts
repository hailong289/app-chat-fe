"use client";

import { io, Socket } from "socket.io-client";

// Cấu hình socket
const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:8080";

// Tạo socket instance với các options
export const socket: Socket = io(SOCKET_URL, {
  autoConnect: false, // Không tự động kết nối
  transports: ["websocket", "polling"], // Fallback transport
  timeout: 10000, // Timeout 10s
  reconnection: true, // Tự động reconnect
  reconnectionAttempts: 5, // Số lần retry
  reconnectionDelay: 1000, // Delay giữa các lần retry
});

// Socket manager class để quản lý connection
export class SocketManager {
  private static instance: SocketManager;
  private isConnected: boolean = false;

  private constructor() {
    this.setupEventListeners();
  }

  public static getInstance(): SocketManager {
    if (!SocketManager.instance) {
      SocketManager.instance = new SocketManager();
    }
    return SocketManager.instance;
  }

  private setupEventListeners() {
    socket.on("connect", () => {
      console.log("✅ Socket connected:", socket.id);
      this.isConnected = true;
    });

    socket.on("disconnect", (reason) => {
      console.log("❌ Socket disconnected:", reason);
      this.isConnected = false;
    });

    socket.on("connect_error", (error) => {
      console.error("🔴 Socket connection error:", error);
      this.isConnected = false;
    });

    socket.on("reconnect", (attemptNumber) => {
      console.log("🔄 Socket reconnected after", attemptNumber, "attempts");
      this.isConnected = true;
    });

    socket.on("reconnect_error", (error) => {
      console.error("🔄❌ Socket reconnection failed:", error);
    });
  }

  // Kết nối socket với token authentication
  public connect(token?: string) {
    if (this.isConnected) {
      console.log("Socket already connected");
      return;
    }

    // Thêm auth token nếu có
    if (token) {
      socket.auth = { token };
    }

    socket.connect();
  }

  // Ngắt kết nối
  public disconnect() {
    if (socket.connected) {
      socket.disconnect();
      this.isConnected = false;
    }
  }

  // Kiểm tra trạng thái kết nối
  public get connected(): boolean {
    return this.isConnected && socket.connected;
  }

  // Gửi message
  public emit(event: string, data?: any): void {
    if (this.connected) {
      socket.emit(event, data);
    } else {
      console.warn("Socket not connected, cannot emit:", event);
    }
  }

  // Lắng nghe events
  public on(event: string, callback: (...args: any[]) => void): void {
    socket.on(event, callback);
  }

  // Hủy lắng nghe events
  public off(event: string, callback?: (...args: any[]) => void): void {
    socket.off(event, callback);
  }

  // Join room
  public joinRoom(roomId: string): void {
    this.emit("join_room", { roomId });
  }

  // Leave room
  public leaveRoom(roomId: string): void {
    this.emit("leave_room", { roomId });
  }

  // Gửi message trong room
  public sendMessage(roomId: string, message: string): void {
    this.emit("send_message", {
      roomId,
      message,
      timestamp: new Date().toISOString(),
    });
  }
}

// Export singleton instance
export const socketManager = SocketManager.getInstance();