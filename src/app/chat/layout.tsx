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
  return children;
}