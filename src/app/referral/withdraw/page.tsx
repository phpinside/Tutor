import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { getCurrentReferrer } from '@/app/actions/auth'
import { getWithdrawalInfo } from '@/app/actions/teacher'
import WithdrawalClient from './WithdrawalClient'

export default async function WithdrawalPage() {
  const cookieStore = await cookies()
  const teacherId = cookieStore.get('teacherId')?.value

  // 检查是否已登录
  if (!teacherId) {
    redirect('/auth/login?redirect=/referral/withdraw')
  }

  // 获取当前用户信息
  const currentUserResult = await getCurrentReferrer()
  if (!currentUserResult.success || !currentUserResult.teacher) {
    redirect('/auth/login?redirect=/referral/withdraw')
  }

  const teacher = currentUserResult.teacher

  // 获取提现信息
  const result = await getWithdrawalInfo(teacher.id)

  if (!result.success || !('data' in result) || !result.data) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white py-8 px-4">
        <div className="max-w-4xl mx-auto">
          <div className="card text-center py-12">
            <div className="text-6xl mb-4">😕</div>
            <p className="text-gray-600">加载提现信息失败</p>
          </div>
        </div>
      </div>
    )
  }

  return <WithdrawalClient data={result.data} teacherId={teacher.id} />
}
