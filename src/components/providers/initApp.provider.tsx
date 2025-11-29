"use client";
import useAuthStore from "@/store/useAuthStore";
import useContactStore from "@/store/useContactStore";
import { useEffect } from "react";
import { useSocket } from "./SocketProvider";

export const InitApp = () => {
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
  return <></>;
};
