import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const teacherId = id.trim()

    // 查询教师信息
    const teacher = await prisma.teacher.findUnique({
      where: { id: teacherId },
      select: {
        id: true,
        name: true,
        phone: true,
      },
    })

    if (!teacher) {
      return NextResponse.json(
        { success: false, error: '教师不存在' },
        { status: 404 }
      )
    }

    // 查询该教师作为被邀请人的最新referral记录状态
    const referral = await prisma.referral.findFirst({
      where: { referredId: teacherId },
      orderBy: { createdAt: 'desc' },
      select: { status: true },
    })

    return NextResponse.json({
      success: true,
      data: {
        id: teacher.id,
        name: teacher.name,
        phone: teacher.phone,
        referralStatus: referral?.status ?? null,
      },
    })
  } catch (error) {
    console.error('查询教师信息失败:', error)
    return NextResponse.json(
      { success: false, error: '服务器错误' },
      { status: 500 }
    )
  }
}
