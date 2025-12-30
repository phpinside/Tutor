import { redirect } from 'next/navigation'

export default function HomePage({
  searchParams
}: {
  searchParams: { ref?: string }
}) {
  // 如果有邀请码，先通过 init 路由处理
  if (searchParams.ref) {
    redirect(`/api/init?ref=${searchParams.ref}`)
  }
  
  // 重定向到引导页面
  redirect('/onboarding')
}

