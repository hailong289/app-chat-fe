import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Bạn Bè - Ichat",
  description: "Bạn bè trên Ichat",
};

export default function ChatLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
