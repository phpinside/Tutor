import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { getAllWithdrawals } from '@/app/actions/teacher'
import WithdrawalManagementClient from './WithdrawalManagementClient'

export default async function WithdrawalsManagementPage({
  searchParams
}: {
  searchParams: Promise<{
    status?: string
    startDate?: string
    endDate?: string
    search?: string
  }>
}) {
  // 检查管理员登录
  const cookieStore = await cookies()
  const adminSession = cookieStore.get('admin_session')

  if (!adminSession) {
    redirect('/admin/login')
  }

  // 获取提现申请列表
  const params = await searchParams
  const result = await getAllWithdrawals({
    status: params.status,
    startDate: params.startDate,
    endDate: params.endDate,
    search: params.search
  })

  if (!result.success || !result.withdrawals) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800">加载提现申请列表失败</p>
        </div>
      </div>
    )
  }

  return (
    <WithdrawalManagementClient
      initialWithdrawals={result.withdrawals}
      initialFilters={params}
    />
  )
}
