import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
const privatePaths = ['/me'];
const publicPaths = ['/auth', '/auth/login', '/auth/register'];
// This function can be marked `async` if using `await` inside
export function middleware(request: NextRequest) {
  console.log('Middleware is running');
  const tokens = request.cookies.get("tokens")?.value;
  if (tokens) {
    const dateNow = Math.floor(Date.now() / 1000);
    const { accessToken, refreshToken, expiredAt } = JSON.parse(tokens);
    if (!accessToken || !refreshToken || Number(expiredAt) < dateNow) { // Token hết hạn hoặc không tồn tại
      return NextResponse.redirect(new URL('/auth', request.url));
    } else {
       const isPublicPath = publicPaths.some((path) => request.nextUrl.pathname === path || request.nextUrl.pathname.startsWith(path + '/'));
       if (isPublicPath) { // Đã đăng nhập mà vẫn vào trang auth
         return NextResponse.redirect(new URL('/', request.url));
       }
    }
  } else { // Không có token
    const isPublicPath = publicPaths.some((path) => request.nextUrl.pathname === path || request.nextUrl.pathname.startsWith(path + '/'));
    if (!isPublicPath) {
      return NextResponse.redirect(new URL('/auth', request.url));
    }
  }

  return NextResponse.next();
}
 
// See "Matching Paths" below to learn more
export const config = {
  matcher: [
    '/', 
    '/me/:path*', 
    '/auth/:path*', 
    '/chat/:path*',
    '/settings/:path*'
  ],
}