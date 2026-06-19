import type { Metadata } from "next";
import { GuestCallBootstrap } from "@/components/call/GuestCallBootstrap";

export const metadata: Metadata = {
  title: "Cuộc gọi - Ichat",
  description: "Cuộc gọi video/audio trên Ichat",
};

export default function CallLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <GuestCallBootstrap />
      {children}
    </>
  );
}

