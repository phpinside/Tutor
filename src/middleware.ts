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

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname
  
  // 检查管理后台路径
  if (
    pathname.startsWith('/admin') &&
    !pathname.startsWith('/admin/login') &&
    !pathname.startsWith('/api/admin/login')
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
      const requiredRoles = getRequiredRoles(pathname)
      
      if (requiredRoles && !requiredRoles.includes(userRole)) {
        // 没有权限，重定向到老师管理页面（所有管理员都能访问）
        return NextResponse.redirect(new URL('/admin/teachers', request.url))
      }
    } catch (error) {
      // session 数据解析失败，重定向到登录页
      return NextResponse.redirect(new URL('/admin/login', request.url))
    }
  }

  // 检查邀请看板路径（使用统一的 teacherId）
  if (pathname.startsWith('/referral/dashboard') || pathname.startsWith('/referral/withdraw')) {
    // 检查是否有 teacherId cookie
    const teacherId = request.cookies.get('teacherId')
    
    if (!teacherId) {
      // 未登录，重定向到统一登录页
      const loginUrl = new URL('/auth/login', request.url)
      loginUrl.searchParams.set('redirect', pathname + request.nextUrl.search)
      return NextResponse.redirect(loginUrl)
    }
  }

  // 检查新手引导路径（需要老师登录）
  // 注意：由于 middleware 运行在 Edge Runtime，不能使用 Prisma
  // 手机号和密码的检查移到首页逻辑中处理
  if (pathname.startsWith('/onboarding')) {
    // 检查是否有老师登录 cookie
    const teacherId = request.cookies.get('teacherId')
    
    if (!teacherId) {
      // 未登录，重定向到登录页
      return NextResponse.redirect(new URL('/auth/login', request.url))
    }
    
    // 已登录的检查（phone/password）由首页处理
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/admin/:path*', '/referral/dashboard/:path*', '/referral/withdraw/:path*'],
}




