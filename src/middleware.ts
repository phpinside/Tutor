import { NextResponse, type NextRequest } from 'next/server'
import { SESSION_COOKIE } from '@/lib/auth/policy'

export function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname
  if (path === '/admin/login' || path === '/operator/login') {
    const url = new URL('/auth/login', request.url)
    url.search = request.nextUrl.search
    return NextResponse.redirect(url)
  }
  // Edge 只做登录态粗筛；页面、API、Server Actions 通过数据库会话做最终鉴权。
  if (!request.cookies.get(SESSION_COOKIE)) {
    const url = new URL('/auth/login', request.url)
    url.searchParams.set('redirect', path + request.nextUrl.search)
    return NextResponse.redirect(url)
  }
  const forwarded = new Headers(request.headers)
  forwarded.set('x-tutor-destination', path + request.nextUrl.search)
  return NextResponse.next({ request: { headers: forwarded } })
}
export const config = {
  matcher: ['/admin/:path*', '/operator/:path*', '/referral/dashboard/:path*', '/referral/withdraw/:path*', '/onboarding/:path*', '/account/:path*'],
}
