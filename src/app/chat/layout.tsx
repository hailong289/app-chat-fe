import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Đăng nhập - ChatApp",
  description: "Đăng nhập vào ChatApp",
};

export default function ChatLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}