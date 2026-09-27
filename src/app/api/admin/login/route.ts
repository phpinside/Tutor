import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyAdminCredentials } from '@/lib/adminAuth'
import { checkRateLimit, getClientIpFromForwarded } from '@/lib/rateLimit'

export async function POST(request: Request) {
  try {
    const { username, password } = await request.json()

    // 登录限流（防爆破）：同一 IP+账号 15 分钟内最多 5 次
    const ip = getClientIpFromForwarded(request.headers.get('x-forwarded-for'))
    const rl = checkRateLimit(`login:admin:${ip}:${username || 'unknown'}`, 5, 15 * 60 * 1000)
    if (!rl.allowed) {
      return NextResponse.json(
        { error: `尝试次数过多，请 ${Math.ceil(rl.retryAfterSec / 60)} 分钟后再试` },
        { status: 429 }
      )
    }

    const account = await verifyAdminCredentials(username, password)

    if (account) {
      // 设置 cookie 标记已登录，包含角色信息
      const cookieStore = await cookies()
      const sessionData = JSON.stringify({
        authenticated: true,
        role: account.role
      })
      
      cookieStore.set('admin_session', sessionData, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 7, // 7 天
        path: '/',
      })

      // 清除运营身份，避免 cookie 冲突导致 getViewerInfo 误判
      cookieStore.delete('operator_session')

      return NextResponse.json({ success: true })
    } else {
      return NextResponse.json(
        { error: '账号或密码错误' },
        { status: 401 }
      )
    }
  } catch (error) {
    return NextResponse.json(
      { error: '登录请求处理失败' },
      { status: 500 }
    )
  }
}


