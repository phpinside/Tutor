import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

export async function POST() {
  try {
    // 删除登录 cookie
    const cookieStore = await cookies()
    cookieStore.delete('admin_session')

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json(
      { error: '退出登录失败' },
      { status: 500 }
    )
  }
}

