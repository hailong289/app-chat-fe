"use client";

import { useEffect, useState, useCallback } from "react";
import { socketManager } from "@/socket";

export interface UseSocketOptions {
  autoConnect?: boolean;
  token?: string;
}

export function useSocket(options: UseSocketOptions = {}) {
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);

  useEffect(() => {
    const handleConnect = () => {
      setIsConnected(true);
      setConnectionError(null);
    };

    const handleDisconnect = () => {
      setIsConnected(false);
    };

    const handleError = (error: any) => {
      setConnectionError(error.message || "Connection error");
      setIsConnected(false);
    };

    // Setup event listeners
    socketManager.on("connect", handleConnect);
    socketManager.on("disconnect", handleDisconnect);
    socketManager.on("connect_error", handleError);

    // Auto connect nếu được enable
    if (options.autoConnect !== false) {
      socketManager.connect(options.token);
    }

    // Cleanup
    return () => {
      socketManager.off("connect", handleConnect);
      socketManager.off("disconnect", handleDisconnect);
      socketManager.off("connect_error", handleError);
      
      if (options.autoConnect !== false) {
        socketManager.disconnect();
      }
    };
  }, [options.autoConnect, options.token]);

  const connect = useCallback((token?: string) => {
    socketManager.connect(token);
  }, []);

  const disconnect = useCallback(() => {
    socketManager.disconnect();
  }, []);

  const emit = useCallback((event: string, data?: any) => {
    socketManager.emit(event, data);
  }, []);

  const joinRoom = useCallback((roomId: string) => {
    socketManager.joinRoom(roomId);
  }, []);

  const leaveRoom = useCallback((roomId: string) => {
    socketManager.leaveRoom(roomId);
  }, []);

  const sendMessage = useCallback((roomId: string, message: string) => {
    socketManager.sendMessage(roomId, message);
  }, []);

  return {
    isConnected,
    connectionError,
    connect,
    disconnect,
    emit,
    joinRoom,
    leaveRoom,
    sendMessage,
    socket: socketManager,
  };
}