import { redirect } from 'next/navigation'

export default async function HomePage({
  searchParams
}: {
  searchParams: Promise<{ ref?: string }>
}) {
  const params = await searchParams
  
  // 如果有邀请码，先通过 init 路由处理
  if (params.ref) {
    redirect(`/api/init?ref=${params.ref}`)
  }
  
  // 重定向到引导页面
  redirect('/onboarding')
}

