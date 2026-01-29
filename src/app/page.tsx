import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'

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
  
  // 已登录：直接跳转到引导页面
  // 注：所有用户注册时必须填写完整信息，无需额外检查
  redirect('/onboarding')
}

