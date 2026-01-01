import { notFound } from 'next/navigation'
import { cookies } from 'next/headers'
import { getReferralDataByViewCode } from '@/app/actions/teacher'
import ReferralDashboardClient from './ReferralDashboardClient'

export default async function ReferralDashboardPage({
  params
}: {
  params: Promise<{ viewCode: string }>
}) {
  const { viewCode } = await params
  const cookieStore = await cookies()
  
  const result = await getReferralDataByViewCode(viewCode)
  
  if (!result.success || !result.data) {
    notFound()
  }
  
  const { data } = result
  
  // 自动设置 cookie，实现快速登录/切换账号
  if (data.teacherId) {
    cookieStore.set('teacherId', data.teacherId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 365 // 1年
    })
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
