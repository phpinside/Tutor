import { NextResponse } from 'next/server'
import { switchWorkspace } from '@/app/actions/auth'
import { isSameOrigin } from '@/lib/auth/origin'
export async function POST(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ success: false, error: '请求来源无效，请刷新页面后重试' }, { status: 403 })
  try {
    const { role } = await request.json()
    const result = await switchWorkspace(role)
    return NextResponse.json(result, { status: result.success ? 200 : 403 })
  } catch { return NextResponse.json({ success: false, error: '切换失败，请重试' }, { status: 400 }) }
}
