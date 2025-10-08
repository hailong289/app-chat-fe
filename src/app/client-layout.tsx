"use client";

import { usePathname } from "next/navigation";
import { Header } from "@/components/intro/header";
import { LeftSide } from "@/components/intro/left-side";

export function ClientLayout({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const isAuthPage = path.startsWith("/auth");
  
  // Define valid routes
  const validRoutes = ["/", "/chat", "/settings"];
  const isValidRoute = !validRoutes.some(route => 
    path === route || path.startsWith(route + "/")
  ) || isAuthPage;

  if (isValidRoute) {
    // layout cho trang login/register/404
    return (
      <main className="w-full h-screen">
        {children}
      </main>
    );
  }

  // layout mặc định cho app
  return (
    <div className="flex h-screen">
      <nav className="w-[100px]">
        <Header />
      </nav>
      <main className="w-[calc(100%-100px)] h-screen flex">
        <LeftSide />
        <div className="w-full overflow-y-auto">
          {children}
        </div>
      </main>
    </div>
  );
}
