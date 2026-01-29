import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { prisma } from '@/lib/prisma'

export default async function HomePage({
  searchParams
}: {
  searchParams: Promise<{ ref?: string }>
}) {
  const params = await searchParams
  const refCode = params.ref
  
  // 获取登录状态
  const cookieStore = await cookies()
  const teacherId = cookieStore.get('teacherId')?.value
  
  // 未登录：跳转到登录/注册页
  if (!teacherId) {
    // 如果有邀请码，传递到注册页
    if (refCode) {
      redirect(`/auth/register?ref=${refCode}`)
    }
    // 没有邀请码，跳转到登录页
    redirect('/auth/login')
  }
  
  // 已登录：检查是否有手机号和密码
  const teacher = await prisma.teacher.findUnique({
    where: { id: teacherId },
    select: { phone: true, password: true }
  })
  
  // 如果找不到用户（可能 cookie 过期或数据被删除），跳转登录
  if (!teacher) {
    if (refCode) {
      redirect(`/auth/register?ref=${refCode}`)
    }
    redirect('/auth/login')
  }
  
  // 如果没有手机号或密码，跳转到补充信息页
  if (!teacher.phone || !teacher.password) {
    redirect('/auth/complete')
  }
  
  // 已完成认证，跳转到引导页面
  redirect('/onboarding')
}

