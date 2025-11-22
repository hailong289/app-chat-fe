"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import useAuthStore from "@/store/useAuthStore";
import { getCookie } from "cookies-next";

// Public paths: không cần authentication
const publicPaths = ["/auth", "/auth/login", "/auth/register", "/dashboard"];

export function RouteGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { isAuthenticated, tokens } = useAuthStore();
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    // Chỉ chạy ở client-side
    if (typeof window === "undefined") return;

    // Đợi một chút để store rehydrate từ localStorage
    const checkAuth = () => {
      // Kiểm tra token từ cookie (fallback khi store chưa rehydrate)
      let hasValidToken = false;
      try {
        const cookieTokens = getCookie("tokens");
        if (cookieTokens) {
          const parsed = JSON.parse(cookieTokens as string);
          const dateNow = Math.floor(Date.now() / 1000);
          if (
            parsed?.accessToken &&
            parsed?.refreshToken &&
            Number(parsed?.expiredAt) > dateNow
          ) {
            hasValidToken = true;
          }
        }
      } catch {
        // ignore
      }

      // Sử dụng token từ store hoặc cookie
      const isValidAuth = isAuthenticated || hasValidToken;

      if (isValidAuth) {
        // Đã đăng nhập
        const isAuthPath = pathname === "/auth" || pathname.startsWith("/auth/");
        const isDashboard = pathname === "/dashboard";

        if (isAuthPath || isDashboard) {
          // Đã đăng nhập mà vẫn vào trang auth/dashboard → redirect về chat
          router.replace("/chat");
          return;
        }
      } else {
        // Chưa đăng nhập
        const isPublicPath = publicPaths.some(
          (path) => pathname === path || pathname.startsWith(path + "/")
        );

        if (!isPublicPath) {
          // Chưa đăng nhập và truy cập protected route → redirect về dashboard
          router.replace("/dashboard");
          return;
        }
      }

      setIsChecking(false);
    };

    // Đợi store rehydrate (thường mất vài ms)
    const timer = setTimeout(checkAuth, 100);
    return () => clearTimeout(timer);
  }, [pathname, router, isAuthenticated, tokens]);

  // Hiển thị loading hoặc children tùy vào trạng thái
  if (isChecking) {
    return <>{children}</>; // Hoặc có thể return loading spinner
  }

  return <>{children}</>;
}

