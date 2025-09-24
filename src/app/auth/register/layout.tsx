import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Đăng ký - ChatApp",
  description: "Đăng ký tài khoản mới trên ChatApp",
};

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}