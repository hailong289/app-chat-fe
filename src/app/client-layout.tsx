"use client";
import { useEffect, Suspense } from "react";
import { usePathname } from "next/navigation";
import { Header } from "@/components/intro/header";
import { LeftSide } from "@/components/intro/left-side";
import { useFirebase } from "@/components/providers/firebase.provider";
import { SocketEventChatGlobal } from "@/components/chat/socketChatEventGlobal";
import useCounterStore from "@/store/useCounterStore";
import { SocketProvider } from "@/components/providers/SocketProvider";
import { InitAppChat } from "@/components/chat/initAppChat.provider";

export function ClientLayout({ children }: { children: React.ReactNode }) {
  const firebase = useFirebase();
  const path = usePathname();
  // Trang auth: /auth, /auth/login, /auth/register, ...
  const isAuthPage = path.startsWith("/auth");

  // Những route dùng layout app chính
  const appRoutes = ["/", "/chat", "/settings", "/contacts"];
  const isInAppRoute = appRoutes.some(
    (route) => path === route || path.startsWith(`${route}/`)
  );

  // Dùng layout đơn giản cho: auth + các route không thuộc appRoutes (kiểu 404 / intro riêng)
  const useSimpleLayout = isAuthPage || !isInAppRoute;

  useEffect(() => {
    const requestPermission = async () => {
      try {
        await firebase.requestPermission();
        console.log("🚀 Thông báo quyền đã được cấp.");
      } catch (err) {
        console.error("🚫 Không thể cấp quyền thông báo.", err);
      }
    };

    requestPermission();
  }, [firebase]);

  // Layout đơn giản: auth / 404 / intro khác
  if (useSimpleLayout) {
    return (
      <main className="w-full h-screen bg-slate-900 text-foreground">
        {children}
      </main>
    );
  }

  // Layout chính của app chat
  return (
    <SocketProvider url={process.env.NEXT_PUBLIC_SOCKET_URL}>
      <InitAppChat />
      <div className="flex h-screen w-full bg-slate-900 text-foreground">
        <nav className="relative h-full">
          <Suspense fallback={<div className="w-[60px] h-full" />}>
            <Header />
          </Suspense>
        </nav>

        <main className="flex-1 h-screen flex overflow-hidden">
          {/* Global socket listener / toasts / events */}
          <SocketEventChatGlobal />

          <Suspense fallback={<div className={`h-full`} />}>
            <LeftSide />
          </Suspense>

          <div className="flex-1 overflow-y-auto">{children}</div>
        </main>
      </div>
    </SocketProvider>
  );
}
