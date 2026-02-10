import { NextResponse } from 'next/server'
import { NextRequest } from 'next/server'
import { cookies } from 'next/headers'
import { prisma } from '@/lib/prisma'
import { createReferralRecord } from '@/app/actions/teacher'

/**
 * 初始化路由 - 处理邀请关系绑定
 * 兼容旧的邀请链接，支持已登录和未登录用户
 */
export async function GET(request: NextRequest) {
  try {
    // 获取邀请码参数
    const searchParams = request.nextUrl.searchParams
    const refCode = searchParams.get('ref')
    
    // 获取基础URL
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    
    // 检查是否已登录
    const cookieStore = await cookies()
    const teacherId = cookieStore.get('teacherId')?.value
    
    // 如果已登录且有邀请码，尝试绑定邀请关系
    if (teacherId && refCode) {
      try {
        // 获取用户信息
        const teacher = await prisma.teacher.findUnique({
          where: { id: teacherId },
          select: { id: true, invitedById: true }
        })
        
        // 如果用户还没有邀请人，绑定邀请关系
        if (teacher && !teacher.invitedById) {
          // 查找邀请人
          const referrer = await prisma.teacher.findUnique({
            where: { inviteCode: refCode.trim().toUpperCase() },
            select: { id: true }
          })
          
          if (referrer && referrer.id !== teacherId) {
            // 更新邀请关系
            await prisma.teacher.update({
              where: { id: teacherId },
              data: { invitedById: referrer.id }
            })
            
            // 创建邀请记录（包括直接和间接邀请）
            await createReferralRecord(referrer.id, teacherId)
          }
        }
        
        // 重定向回 onboarding
        return NextResponse.redirect(new URL('/onboarding', baseUrl))
      } catch (error) {
        console.error('绑定邀请关系失败:', error)
        // 即使失败也重定向到 onboarding，不影响用户使用
        return NextResponse.redirect(new URL('/onboarding', baseUrl))
      }
    }
    
    // 未登录，重定向到注册页（携带邀请码）
    const redirectUrl = refCode ? `/auth/register?ref=${refCode}` : '/auth/register'
    return NextResponse.redirect(new URL(redirectUrl, baseUrl))
  } catch (error) {
    console.error('初始化路由错误:', error)
    // 发生错误时，根据是否有邀请码决定重定向位置
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    const searchParams = request.nextUrl.searchParams
    const refCode = searchParams.get('ref')
    const redirectUrl = refCode ? `/auth/register?ref=${refCode}` : '/auth/login'
    return NextResponse.redirect(new URL(redirectUrl, baseUrl))
  }
}


