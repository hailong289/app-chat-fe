import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Bỏ qua middleware khi build cho Tauri (static export không hỗ trợ middleware)
const isTauriBuild = process.env.TAURI_BUILD === "true";

// Public paths: không cần authentication
const publicPaths = ["/auth", "/auth/login", "/auth/register", "/dashboard"];

export function middleware(request: NextRequest) {
  // Skip middleware khi build cho Tauri - sẽ dùng RouteGuard component thay thế
  if (isTauriBuild) {
    return NextResponse.next();
  }

  console.log("Middleware is running");
  const tokens = request.cookies.get("tokens")?.value;
  const { pathname } = request.nextUrl;

  if (tokens) {
    const dateNow = Math.floor(Date.now() / 1000);
    const { accessToken, refreshToken, expiredAt } = JSON.parse(tokens);

    if (!accessToken || !refreshToken || Number(expiredAt) < dateNow) {
      // Token hết hạn hoặc không tồn tại → redirect về dashboard
      return NextResponse.redirect(new URL("/dashboard", request.url));
    } else {
      // Đã đăng nhập
      const isAuthPath = pathname === "/auth" || pathname.startsWith("/auth/");
      const isDashboard = pathname === "/dashboard";

      if (isAuthPath || isDashboard) {
        // Đã đăng nhập mà vẫn vào trang auth/dashboard → redirect về chat
        return NextResponse.redirect(new URL("/chat", request.url));
      }
    }
  } else {
    // Không có token
    const isPublicPath = publicPaths.some(
      (path) => pathname === path || pathname.startsWith(path + "/")
    );

    if (!isPublicPath) {
      // Chưa đăng nhập và truy cập protected route → redirect về dashboard
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
  }

  return NextResponse.next();
}

// See "Matching Paths" below to learn more
export const config = {
  matcher: [
    "/",
    "/dashboard",
    "/me/:path*",
    "/auth/:path*",
    "/chat/:path*",
    "/settings/:path*",
    "/contacts/:path*",
  ],
};
