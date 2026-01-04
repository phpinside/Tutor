import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  // 检查管理后台路径
  if (
    request.nextUrl.pathname.startsWith('/admin') &&
    !request.nextUrl.pathname.startsWith('/admin/login') &&
    !request.nextUrl.pathname.startsWith('/api/admin/login')
  ) {
    // 检查是否有管理员登录 cookie
    const session = request.cookies.get('admin_session')
    
    if (!session) {
      // 未登录，重定向到登录页
      return NextResponse.redirect(new URL('/admin/login', request.url))
    }
  }

  // 检查邀请看板路径（需要邀请人登录）
  if (request.nextUrl.pathname.startsWith('/referral/dashboard')) {
    // 检查是否有邀请人登录 cookie
    const referrerSession = request.cookies.get('referrer_session')
    
    if (!referrerSession) {
      // 未登录，重定向到邀请人登录页
      const loginUrl = new URL('/referral/login', request.url)
      loginUrl.searchParams.set('redirect', request.nextUrl.pathname + request.nextUrl.search)
      return NextResponse.redirect(loginUrl)
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/admin/:path*', '/referral/dashboard/:path*'],
}




