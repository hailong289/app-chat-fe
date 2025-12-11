"use client";
import { DocSocketProvider } from "@/components/providers/DocSocketProvider";

export default function DocsLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <DocSocketProvider>{children}</DocSocketProvider>;
}
