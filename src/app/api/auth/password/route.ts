import { NextResponse } from 'next/server'
import { updateOwnPassword } from '@/app/actions/auth'
import { isSameOrigin } from '@/lib/auth/origin'
export async function POST(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ success: false }, { status: 403 })
  try {
    const { oldPassword, newPassword } = await request.json()
    const result = await updateOwnPassword(oldPassword, newPassword)
    return NextResponse.json(result, { status: result.success ? 200 : 400 })
  } catch { return NextResponse.json({ success: false, error: '修改失败，请重试' }, { status: 400 }) }
}
