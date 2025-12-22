import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

// 写死的账号密码
const ADMIN_CREDENTIALS = {
  username: 'admin',
  password: 'admin123'
}

export async function POST(request: Request) {
  try {
    const { username, password } = await request.json()

    // 验证账号密码
    if (username === ADMIN_CREDENTIALS.username && password === ADMIN_CREDENTIALS.password) {
      // 设置 cookie 标记已登录
      // 使用简单的 token（实际项目中应该使用 JWT 或其他安全方案）
      const cookieStore = await cookies()
      cookieStore.set('admin_session', 'authenticated', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 7, // 7 天
        path: '/',
      })

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

