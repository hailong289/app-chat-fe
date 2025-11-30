"use client";
import useAuthStore from "@/store/useAuthStore";
import useContactStore from "@/store/useContactStore";
import { useEffect } from "react";
import { useSocket } from "../providers/SocketProvider";
import { deleteOldMessagesKeepLatest } from "@/utils/localStorage";

export const InitAppChat = () => {
  const contactState = useContactStore((state) => state);
  const authState = useAuthStore((state) => state);
  const { socket } = useSocket();
  useEffect(() => {
    if (!authState.isAuthenticated) return;
    contactState.getFriends();
    contactState.getAllContacts();
    if (!socket) return;
    contactState.checkOnlineStatus(socket);
  }, [authState.isAuthenticated, socket]);
  // chạy 1 lần khi mount
  useEffect(() => {
    // Xoá tin nhắn cũ, chỉ giữ lại limit mới nhất
    deleteOldMessagesKeepLatest();
  }, []);
  return <></>;
};
