import { SocketEventChatGlobal } from "@/components/chat/socketChatEventGlobal";
import { SocketProvider } from "@/components/providers/SocketProvider";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Nhắn tin - Ichat",
  description: "Nhắn tin với bạn bè trên Ichat",
};

export default function ChatLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SocketProvider url={process.env.NEXT_PUBLIC_SOCKET_URL}>
      <SocketEventChatGlobal />
      {children}
    </SocketProvider>
  );
}
