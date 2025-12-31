import { NextRequest, NextResponse } from 'next/server'
import { ensureInviteCodes } from '@/app/actions/teacher'

export async function POST(request: NextRequest) {
  try {
    const { teacherId } = await request.json()
    
    if (!teacherId) {
      return NextResponse.json(
        { success: false, error: '缺少teacherId' },
        { status: 400 }
      )
    }
    
    // 生成或获取邀请码
    const result = await ensureInviteCodes(teacherId)
    
    if (result.success) {
      return NextResponse.json({
        success: true,
        inviteCode: result.inviteCode,
        viewCode: result.viewCode
      })
    } else {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 500 }
      )
    }
  } catch (error) {
    console.error('Generate invite codes error:', error)
    return NextResponse.json(
      { success: false, error: '生成邀请码失败' },
      { status: 500 }
    )
  }
}
