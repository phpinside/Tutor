import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { prisma } from '@/lib/prisma'
import { NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  const cookieStore = await cookies()
  let teacherId = cookieStore.get('teacherId')?.value
  
  // 获取邀请码参数
  const searchParams = request.nextUrl.searchParams
  const refCode = searchParams.get('ref')
  
  let needNewTeacher = false
  let referrerId: string | null = null
  
  // 如果有邀请码，验证邀请码
  if (refCode) {
    const referrer = await prisma.teacher.findUnique({
      where: { inviteCode: refCode },
      select: { id: true }
    })
    
    if (referrer) {
      referrerId = referrer.id
      // 如果有有效邀请码，总是创建新老师（即使已有 cookie）
      needNewTeacher = true
    }
  }
  
  // 检查 teacherId 是否有效
  if (!needNewTeacher && teacherId) {
    const existingTeacher = await prisma.teacher.findUnique({
      where: { id: teacherId }
    })
    
    if (!existingTeacher) {
      // teacherId 无效（可能是数据库被重置）
      needNewTeacher = true
    }
  } else if (!needNewTeacher) {
    // 没有 teacherId
    needNewTeacher = true
  }
  
  // 创建新老师
  if (needNewTeacher) {
    const teacher = await prisma.teacher.create({
      data: {
        status: 'NOT_STARTED',
        invitedById: referrerId
      }
    })
    
    teacherId = teacher.id
    
    // 如果有邀请人，创建邀请记录
    if (referrerId) {
      await prisma.referral.create({
        data: {
          referrerId: referrerId,
          referredId: teacher.id,
          status: 'VALID'
        }
      })
    }
    
    // 设置 cookie
    cookieStore.set('teacherId', teacherId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 365 // 1年
    })
  }
  
  // 重定向到引导页，如果有邀请码则携带在 URL 中
  const redirectUrl = refCode ? `/onboarding?ref=${refCode}` : '/onboarding'
  return NextResponse.redirect(new URL(redirectUrl, process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'))
}

