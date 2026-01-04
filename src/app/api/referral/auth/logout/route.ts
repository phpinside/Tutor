import { NextRequest, NextResponse } from 'next/server'
import { logoutReferrer } from '@/app/actions/auth'

export async function POST(request: NextRequest) {
  try {
    const result = await logoutReferrer()

    if (result.success) {
      return NextResponse.json(result, { status: 200 })
    } else {
      return NextResponse.json(result, { status: 400 })
    }
  } catch (error) {
    console.error('登出API错误:', error)
    return NextResponse.json(
      { success: false, error: '服务器错误' },
      { status: 500 }
    )
  }
}
