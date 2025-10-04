import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Cài đặt - Ichat",
  description: "Cài đặt tài khoản và thông tin cá nhân trên Ichat",
};

export default function ChatLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}