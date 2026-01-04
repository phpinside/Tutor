type StatsProps = {
  teachers: {
    total: number
    inProgress: number
    completed: number
    unlocked: number
  }
  referrals: {
    total: number
    valid: number
    invalid: number
    pendingRewards: number
    rewardsSent: number
  }
}

export default function StatisticsCards({ teachers, referrals }: StatsProps) {
  return (
    <div className="mb-6">
      {/* 老师统计 */}
      <div className="mb-3">
        <h3 className="text-sm font-medium text-gray-700 mb-2">老师统计</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg shadow p-4 border border-gray-200">
            <div className="text-2xl font-bold text-gray-900">{teachers.total}</div>
            <div className="text-sm text-gray-600 mt-1">总老师数</div>
          </div>
          <div className="bg-white rounded-lg shadow p-4 border border-blue-200">
            <div className="text-2xl font-bold text-blue-600">{teachers.inProgress}</div>
            <div className="text-sm text-gray-600 mt-1">进行中</div>
          </div>
          <div className="bg-white rounded-lg shadow p-4 border border-success-200">
            <div className="text-2xl font-bold text-success-600">{teachers.completed}</div>
            <div className="text-sm text-gray-600 mt-1">已完成</div>
          </div>
          <div className="bg-white rounded-lg shadow p-4 border border-purple-200">
            <div className="text-2xl font-bold text-purple-600">{teachers.unlocked}</div>
            <div className="text-sm text-gray-600 mt-1">已解锁接单</div>
          </div>
        </div>
      </div>
      
      {/* 邀请统计 */}
      <div>
        <h3 className="text-sm font-medium text-gray-700 mb-2">邀请统计</h3>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="bg-white rounded-lg shadow p-4 border border-gray-200">
            <div className="text-2xl font-bold text-gray-900">{referrals.total}</div>
            <div className="text-sm text-gray-600 mt-1">总邀请数</div>
          </div>
          <div className="bg-white rounded-lg shadow p-4 border border-success-200">
            <div className="text-2xl font-bold text-success-600">{referrals.valid}</div>
            <div className="text-sm text-gray-600 mt-1">有效邀请</div>
          </div>
          <div className="bg-white rounded-lg shadow p-4 border border-warning-200">
            <div className="text-2xl font-bold text-warning-600">{referrals.invalid}</div>
            <div className="text-sm text-gray-600 mt-1">无效邀请</div>
          </div>
          <div className="bg-white rounded-lg shadow p-4 border border-amber-200">
            <div className="text-2xl font-bold text-amber-600">{referrals.pendingRewards}</div>
            <div className="text-sm text-gray-600 mt-1">待发奖励</div>
          </div>
          <div className="bg-white rounded-lg shadow p-4 border border-blue-200">
            <div className="text-2xl font-bold text-blue-600">{referrals.rewardsSent}</div>
            <div className="text-sm text-gray-600 mt-1">已发奖励</div>
          </div>
        </div>
      </div>
    </div>
  )
}
