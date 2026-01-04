import { NextRequest, NextResponse } from 'next/server'
import { registerReferrer } from '@/app/actions/auth'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const result = await registerReferrer(body)

    if (result.success) {
      return NextResponse.json(result, { status: 200 })
    } else {
      return NextResponse.json(result, { status: 400 })
    }
  } catch (error) {
    console.error('注册API错误:', error)
    return NextResponse.json(
      { success: false, error: '服务器错误' },
      { status: 500 }
    )
  }
}
