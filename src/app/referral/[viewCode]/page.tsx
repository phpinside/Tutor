import { notFound, redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { getReferralDataByViewCode } from '@/app/actions/teacher'
import ReferralDashboardClient from './ReferralDashboardClient'

export default async function ReferralDashboardPage({
  params,
  searchParams
}: {
  params: Promise<{ viewCode: string }>
  searchParams: Promise<{ login?: string }>
}) {
  const { viewCode } = await params
  const search = await searchParams
  const cookieStore = await cookies()
  
  const result = await getReferralDataByViewCode(viewCode)
  
  if (!result.success || !result.data) {
    notFound()
  }
  
  const { data } = result
  
  // 如果还没有设置过 cookie（首次访问或需要切换账号），重定向到 login route handler
  const currentTeacherId = cookieStore.get('teacherId')?.value
  if (data.teacherId && currentTeacherId !== data.teacherId && !search.login) {
    redirect(`/api/referral/login?viewCode=${viewCode}&returnUrl=/referral/${viewCode}`)
  }
  
  // 构建邀请链接
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  const inviteUrl = `${baseUrl}?ref=${data.inviteCode}`
  const viewUrl = `${baseUrl}/referral/${viewCode}`
  
  return (
    <ReferralDashboardClient 
      data={data}
      inviteUrl={inviteUrl}
      viewUrl={viewUrl}
    />
  )
}
