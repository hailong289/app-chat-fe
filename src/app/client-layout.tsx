"use client";

import { usePathname } from "next/navigation";
import { Header } from "@/components/intro/header";
import { LeftSide } from "@/components/intro/left-side";
import { useFirebase } from "@/components/providers/firebase.provider";
import { useEffect } from "react";

export function ClientLayout({ children }: { children: React.ReactNode }) {
  const firebase = useFirebase();
  const path = usePathname();
  const isAuthPage = path.startsWith("/auth");

  useEffect(() => {
    const handleRequestPermission = async () => {
      try {
        await firebase.requestPermission();
        console.log("🚀 Thông báo quyền đã được cấp.");
      } catch (err) {
        console.error("🚫 Không thể cấp quyền thông báo.", err);
      }
    };

    handleRequestPermission();
  }, [firebase]);

  // Define valid routes
  const validRoutes = ["/", "/chat", "/settings", "/contacts"];
  const isValidRoute =
    !validRoutes.some(
      (route) => path === route || path.startsWith(route + "/")
    ) || isAuthPage;

  if (isValidRoute) {
    // layout cho trang login/register/404
    return <main className="w-full h-screen">{children}</main>;
  }

  // layout mặc định cho app
  return (
    <div className="flex h-screen w-full">
      <nav className="relative">
        <Header />
      </nav>
      <main className="w-full h-screen flex">
        <LeftSide />
        <div className="w-full overflow-y-auto">{children}</div>
      </main>
    </div>
  );
}
