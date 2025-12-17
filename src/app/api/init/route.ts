import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const cookieStore = await cookies()
  let teacherId = cookieStore.get('teacherId')?.value
  
  let needNewTeacher = false
  
  // 检查 teacherId 是否有效
  if (teacherId) {
    const existingTeacher = await prisma.teacher.findUnique({
      where: { id: teacherId }
    })
    
    if (!existingTeacher) {
      // teacherId 无效（可能是数据库被重置）
      needNewTeacher = true
    }
  } else {
    // 没有 teacherId
    needNewTeacher = true
  }
  
  // 创建新老师
  if (needNewTeacher) {
    const teacher = await prisma.teacher.create({
      data: {
        status: 'NOT_STARTED'
      }
    })
    
    teacherId = teacher.id
    
    // 设置 cookie
    cookieStore.set('teacherId', teacherId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 365 // 1年
    })
  }
  
  // 重定向到引导页
  return NextResponse.redirect(new URL('/onboarding', process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'))
}

