import { isSameOrigin } from '@/lib/auth/origin'
import { NextResponse } from 'next/server'
import { login } from '@/app/actions/auth'

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ success: false, error: '请求来源无效' }, { status: 403 })
  try {
    const result = await login(await request.json())
    return NextResponse.json(result, { status: result.success ? 200 : 401, headers: { 'Cache-Control': 'no-store' } })
  } catch { return NextResponse.json({ success: false, error: '登录请求处理失败' }, { status: 400 }) }
}
