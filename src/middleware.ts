import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  // 只对 /admin 路径进行检查（排除登录页和 API）
  if (
    request.nextUrl.pathname.startsWith('/admin') &&
    !request.nextUrl.pathname.startsWith('/admin/login') &&
    !request.nextUrl.pathname.startsWith('/api/admin/login')
  ) {
    // 检查是否有登录 cookie
    const session = request.cookies.get('admin_session')
    
    if (!session) {
      // 未登录，重定向到登录页
      return NextResponse.redirect(new URL('/admin/login', request.url))
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: '/admin/:path*',
}

