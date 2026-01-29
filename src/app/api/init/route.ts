import { NextResponse } from 'next/server'
import { NextRequest } from 'next/server'

/**
 * 初始化路由 - 重定向到注册页
 * 保留此路由以兼容旧的邀请链接
 * 如果有邀请码参数，会传递到注册页
 */
export async function GET(request: NextRequest) {
  // 获取邀请码参数
  const searchParams = request.nextUrl.searchParams
  const refCode = searchParams.get('ref')
  
  // 重定向到注册页，如果有邀请码则携带在 URL 中
  const redirectUrl = refCode ? `/auth/register?ref=${refCode}` : '/auth/register'
  return NextResponse.redirect(new URL(redirectUrl, process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'))
}


