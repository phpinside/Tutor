import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { getCurrentReferrer } from '@/app/actions/auth'
import { getReferralDataByTeacherId } from '@/app/actions/teacher'
import ReferralDashboard from '@/components/referral/ReferralDashboard'

export default async function ReferralDashboardPage({
  searchParams
}: {
  searchParams: Promise<{
    page?: string
    startDate?: string
    endDate?: string
    taskStatus?: string
    referralStatus?: string
  }>
}) {
  const cookieStore = await cookies()
  const teacherId = cookieStore.get('teacherId')?.value

  // 检查是否已登录
  if (!teacherId) {
    redirect('/auth/login?redirect=/referral/dashboard')
  }

  // 获取当前用户信息
  const currentUserResult = await getCurrentReferrer()
  if (!currentUserResult.success || !currentUserResult.teacher) {
    redirect('/auth/login?redirect=/referral/dashboard')
  }

  const teacher = currentUserResult.teacher

  // 获取邀请数据
  const params = await searchParams
  const result = await getReferralDataByTeacherId(teacher.id, {
    page: params.page ? parseInt(params.page) : 1,
    pageSize: 100,
    startDate: params.startDate,
    endDate: params.endDate,
    taskStatus: params.taskStatus,
    referralStatus: params.referralStatus
  })

  if (!result.success || !result.data) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white py-8 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="card text-center py-12">
            <div className="text-6xl mb-4">😕</div>
            <p className="text-gray-600">加载邀请数据失败</p>
          </div>
        </div>
      </div>
    )
  }

  const { data } = result

  // 构建邀请链接
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  const inviteUrl = `${baseUrl}?ref=${data.inviteCode}`

  return (
    <ReferralDashboard
      data={data}
      inviteUrl={inviteUrl}
      pagination={data.pagination}
      filters={params}
    />
  )
}
