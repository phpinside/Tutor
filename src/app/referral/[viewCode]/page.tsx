import { notFound } from 'next/navigation'
import { getReferralDataByViewCode } from '@/app/actions/teacher'
import ReferralDashboardClient from './ReferralDashboardClient'

export default async function ReferralDashboardPage({
  params
}: {
  params: { viewCode: string }
}) {
  const { viewCode } = params
  
  const result = await getReferralDataByViewCode(viewCode)
  
  if (!result.success || !result.data) {
    notFound()
  }
  
  const { data } = result
  
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
