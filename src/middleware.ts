import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// 路由权限映射：定义每个路径需要的角色
const ROUTE_PERMISSIONS: Record<string, string[]> = {
  '/admin/teachers': ['super_admin', 'teacher_admin'],
  '/admin/referrals': ['super_admin'],
  '/admin/withdrawals': ['super_admin'],
  '/admin/config': ['super_admin'],
}

// 检查路径是否需要权限验证
function getRequiredRoles(pathname: string): string[] | null {
  for (const [route, roles] of Object.entries(ROUTE_PERMISSIONS)) {
    if (pathname.startsWith(route)) {
      return roles
    }
  }
  return null
}

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

    // 解析 session 数据，获取角色
    try {
      const sessionData = JSON.parse(session.value)
      const userRole = sessionData.role

      // 检查当前路径需要的权限
      const requiredRoles = getRequiredRoles(request.nextUrl.pathname)
      
      if (requiredRoles && !requiredRoles.includes(userRole)) {
        // 没有权限，重定向到老师管理页面（所有管理员都能访问）
        return NextResponse.redirect(new URL('/admin/teachers', request.url))
      }
    } catch (error) {
      // session 数据解析失败，重定向到登录页
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




