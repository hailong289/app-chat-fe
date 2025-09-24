import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
const privatePaths = ['/me'];
const publicPaths = ['/auth', '/auth/login', '/auth/register', '/'];
// This function can be marked `async` if using `await` inside
export  function middleware(request: NextRequest) {
     const token = request.cookies.get("access_token")?.value;
   // kiểm tra đã đăng nhập hay chưa
   if(privatePaths.some((path) => request.nextUrl.pathname.startsWith(path))&&!token) {
    return NextResponse.redirect(new URL('/auth', request.url));
   }
      if(publicPaths.some((path) => request.nextUrl.pathname.startsWith(path))&&token) {
    return NextResponse.redirect(new URL('/me', request.url));
   }

  return NextResponse.next();
}
 
// See "Matching Paths" below to learn more
export const config = {
  matcher: ['/me/:path*', '/auth/:path*', '/'],
}