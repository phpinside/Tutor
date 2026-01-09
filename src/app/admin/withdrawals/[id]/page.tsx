import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { getWithdrawalDetail } from '@/app/actions/teacher'
import WithdrawalDetailClient from './WithdrawalDetailClient'

export default async function WithdrawalDetailPage({
  params
}: {
  params: Promise<{ id: string }>
}) {
  // 检查管理员登录
  const cookieStore = await cookies()
  const adminSession = cookieStore.get('admin_session')

  if (!adminSession) {
    redirect('/admin/login')
  }

  const { id } = await params

  // 获取提现详情
  const result = await getWithdrawalDetail(id)

  if (!result.success || !result.withdrawal) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800">{result.error || '加载提现详情失败'}</p>
        </div>
      </div>
    )
  }

  return (
    <WithdrawalDetailClient
      withdrawal={result.withdrawal}
      stats={result.stats}
      adminId={adminSession.value}
    />
  )
}
