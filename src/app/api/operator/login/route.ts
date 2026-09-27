import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import { sanitizeInput } from '@/lib/utils'
import { checkRateLimit, getClientIpFromForwarded } from '@/lib/rateLimit'

export async function POST(request: Request) {
  try {
    const { phone: rawPhone, password } = await request.json()
    const phone = sanitizeInput(rawPhone)

    if (!phone || !password) {
      return NextResponse.json({ error: '请输入手机号和密码' }, { status: 400 })
    }

    // 登录限流（防爆破）：同一 IP+手机号 15 分钟内最多 5 次
    const ip = getClientIpFromForwarded(request.headers.get('x-forwarded-for'))
    const rl = checkRateLimit(`login:operator:${ip}:${phone}`, 5, 15 * 60 * 1000)
    if (!rl.allowed) {
      return NextResponse.json(
        { error: `尝试次数过多，请 ${Math.ceil(rl.retryAfterSec / 60)} 分钟后再试` },
        { status: 429 }
      )
    }

    const operator = await prisma.operator.findUnique({ where: { phone } })

    if (!operator) {
      return NextResponse.json({ error: '手机号或密码错误' }, { status: 401 })
    }

    const passwordMatch = await bcrypt.compare(password, operator.password)
    if (!passwordMatch) {
      return NextResponse.json({ error: '手机号或密码错误' }, { status: 401 })
    }

    if (!operator.isEnabled) {
      return NextResponse.json({ error: '账号已被禁用，请联系管理员' }, { status: 403 })
    }

    const cookieStore = await cookies()
    const sessionData = JSON.stringify({
      operatorId: operator.id,
      name: operator.name,
      role: operator.role, // 'LEARNER_MANAGER'（学管）；鉴权真源在 DB，此为快照
    })

    cookieStore.set('operator_session', sessionData, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7 天
      path: '/',
    })

    // 清除超管身份，避免 cookie 冲突导致 getViewerInfo 误判
    cookieStore.delete('admin_session')

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: '登录请求处理失败' }, { status: 500 })
  }
}
