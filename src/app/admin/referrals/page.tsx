import { getAllReferrals, getReferralOverview } from '@/app/actions/referral'
import ReferralManagementClient from './ReferralManagementClient'

export default async function ReferralsManagementPage({
  searchParams
}: {
  searchParams: { status?: string; search?: string }
}) {
  // 获取筛选参数
  const filters: any = {}
  if (searchParams.status === 'valid') filters.status = 'VALID'
  if (searchParams.status === 'invalid') filters.status = 'INVALID'
  if (searchParams.search) filters.search = searchParams.search
  
  // 获取数据
  const [referralsResult, overviewResult] = await Promise.all([
    getAllReferrals(filters),
    getReferralOverview()
  ])
  
  if (!referralsResult.success || !overviewResult.success) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <p className="text-red-600">加载数据失败，请刷新页面重试</p>
        </div>
      </div>
    )
  }
  
  return (
    <div className="p-6">
      {/* 页面标题 */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">邀请管理</h1>
        <p className="text-gray-600 mt-1">管理所有邀请记录，审核邀请有效性并标记奖励发放状态</p>
      </div>
      
      {/* 统计概览 */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow p-4 border border-gray-200">
          <div className="text-2xl font-bold text-gray-900">{overviewResult.stats.total}</div>
          <div className="text-sm text-gray-600 mt-1">总邀请数</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4 border border-success-200">
          <div className="text-2xl font-bold text-success-600">{overviewResult.stats.valid}</div>
          <div className="text-sm text-gray-600 mt-1">有效邀请</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4 border border-warning-200">
          <div className="text-2xl font-bold text-warning-600">{overviewResult.stats.invalid}</div>
          <div className="text-sm text-gray-600 mt-1">无效邀请</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4 border border-amber-200">
          <div className="text-2xl font-bold text-amber-600">{overviewResult.stats.pendingReward}</div>
          <div className="text-sm text-gray-600 mt-1">待发放奖励</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4 border border-blue-200">
          <div className="text-2xl font-bold text-blue-600">{overviewResult.stats.rewardsSent}</div>
          <div className="text-sm text-gray-600 mt-1">已发放奖励</div>
        </div>
      </div>
      
      {/* 客户端组件处理交互 */}
      <ReferralManagementClient 
        initialReferrals={referralsResult.referrals}
        initialStats={referralsResult.stats}
      />
    </div>
  )
}
