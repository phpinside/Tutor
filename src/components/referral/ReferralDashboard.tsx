'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import dynamic from 'next/dynamic'
import { formatName, formatPhone, formatDateTime } from '@/lib/utils'
import { logoutReferrer } from '@/app/actions/auth'

const PosterGenerator = dynamic(() => import('@/components/referral/PosterGenerator'), {
  ssr: false
})

type ReferralData = {
  referrerName: string | null
  inviteCode: string | null
  stats: {
    directTotal: number
    directValid: number
    directTaught: number
    indirectTotal: number
    indirectValid: number
    indirectTaught: number
    directReward: number
    indirectReward: number
    directTeachingReward: number
    indirectTeachingReward: number
    totalEarnings: number
    totalWithdrawn: number
    totalPending: number
    availableBalance: number
  }
  directReferrals: Array<{
    id: string
    index: number
    referredName: string | null
    referredPhone: string | null
    currentPhase: number
    currentTaskIndex: number
    status: string
    referralStatus: 'PENDING' | 'VALID' | 'INVALID'
    rewardSent: boolean
    adminNote: string | null
    createdAt: Date
  }>
  indirectReferrals: Array<{
    id: string
    index: number
    referredName: string | null
    referredPhone: string | null
    referrerName: string | null // 中间人（B）的名字
    currentPhase: number
    currentTaskIndex: number
    status: string
    referralStatus: 'PENDING' | 'VALID' | 'INVALID'
    adminNote: string | null
    createdAt: Date
  }>
}

type PaginationData = {
  currentPage: number
  pageSize: number
  totalCount: number
  totalPages: number
  hasNextPage: boolean
  hasPrevPage: boolean
}

export default function ReferralDashboard({
  data,
  inviteUrl,
  pagination,
  filters
}: {
  data: ReferralData
  inviteUrl: string
  pagination?: PaginationData
  filters?: {
    page?: string
    startDate?: string
    endDate?: string
    taskStatus?: string
    referralStatus?: string
  }
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { referrerName, inviteCode, stats, directReferrals, indirectReferrals } = data
  const [copiedType, setCopiedType] = useState<'invite' | null>(null)
  const [showPosterGenerator, setShowPosterGenerator] = useState(false)
  const [activeTab, setActiveTab] = useState<'direct' | 'indirect'>('direct')
  
  // 分页状态
  const [directPage, setDirectPage] = useState(1)
  const [indirectPage, setIndirectPage] = useState(1)
  const pageSize = 20
  
  // 计算分页数据
  const directTotalPages = Math.ceil(directReferrals.length / pageSize)
  const indirectTotalPages = Math.ceil(indirectReferrals.length / pageSize)
  
  const paginatedDirectReferrals = directReferrals.slice(
    (directPage - 1) * pageSize,
    directPage * pageSize
  )
  
  const paginatedIndirectReferrals = indirectReferrals.slice(
    (indirectPage - 1) * pageSize,
    indirectPage * pageSize
  )
  
  // 切换Tab时重置分页
  const handleTabChange = (tab: 'direct' | 'indirect') => {
    setActiveTab(tab)
    // 可选：切换Tab时重置到第一页（根据需求决定是否启用）
    // if (tab === 'direct') setDirectPage(1)
    // if (tab === 'indirect') setIndirectPage(1)
  }

  // 筛选状态
  const [filterForm, setFilterForm] = useState({
    startDate: filters?.startDate || '',
    endDate: filters?.endDate || '',
    taskStatus: filters?.taskStatus || '',
    referralStatus: filters?.referralStatus || ''
  })

  const handleCopy = (text: string, type: 'invite') => {
    navigator.clipboard.writeText(text)
    setCopiedType(type)
    setTimeout(() => setCopiedType(null), 2000)
  }

  // 应用筛选
  const applyFilters = () => {
    const params = new URLSearchParams()
    if (filterForm.startDate) params.set('startDate', filterForm.startDate)
    if (filterForm.endDate) params.set('endDate', filterForm.endDate)
    if (filterForm.taskStatus) params.set('taskStatus', filterForm.taskStatus)
    if (filterForm.referralStatus) params.set('referralStatus', filterForm.referralStatus)
    params.set('page', '1') // 重置到第一页

    router.push(`?${params.toString()}`)
  }

  // 清除筛选
  const clearFilters = () => {
    setFilterForm({
      startDate: '',
      endDate: '',
      taskStatus: '',
      referralStatus: ''
    })
    router.push(window.location.pathname)
  }

  // 登出
  const handleLogout = async () => {
    const result = await logoutReferrer()
    if (result.success) {
      router.push('/')
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white py-8 px-4">
      <div className="max-w-6xl mx-auto">
        {/* 顶部用户信息栏 */}
        <div className="flex justify-between items-center mb-6 bg-white rounded-lg shadow-sm px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center">
              <span className="text-xl">👤</span>
            </div>
            <div>
              <div className="font-medium text-gray-900">
                {referrerName || '邀请人'}
              </div>
              <div className="text-sm text-gray-500">邀请看板</div>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="px-4 py-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
          >
            退出登录
          </button>
        </div>

        {/* 页面标题 */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-6">
            {referrerName ? `${referrerName}的邀请看板` : '我的邀请看板'}
          </h1>
          
          {/* 奖励说明卡片 */}
          <div className="bg-gradient-to-br from-amber-50 via-orange-50 to-red-50 border-2 border-amber-200 rounded-2xl p-6 shadow-lg">
            <div className="flex items-center justify-center gap-2 mb-4">
              <span className="text-3xl">💰</span>
              <h2 className="text-2xl font-bold text-amber-900">邀请老师就有钱拿</h2>
              <span className="text-3xl">💰</span>
            </div>
            
            <div className="space-y-3 text-left">
              <div className="flex items-start gap-3 bg-white/80 backdrop-blur-sm rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow">
                <span className="text-2xl flex-shrink-0">✅</span>
                <div>
                  <p className="text-gray-900 font-medium">
                    你直接邀请的老师，成功入驻
                  </p>
                  <p className="text-amber-600 font-bold text-lg mt-1">
                    +{stats.directReward} 元
                  </p>
                </div>
              </div>
              
              <div className="flex items-start gap-3 bg-white/80 backdrop-blur-sm rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow">
                <span className="text-2xl flex-shrink-0">🎓</span>
                <div>
                  <p className="text-gray-900 font-medium">
                    TA 真正开始接课
                  </p>
                  <p className="text-orange-600 font-bold text-lg mt-1">
                    再拿 +{stats.directTeachingReward} 元
                  </p>
                </div>
              </div>
              
              <div className="flex items-start gap-3 bg-white/80 backdrop-blur-sm rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow">
                <span className="text-2xl flex-shrink-0">🔗</span>
                <div>
                  <p className="text-gray-900 font-medium">
                    TA 再邀请别人
                  </p>
                  <p className="text-purple-600 font-bold text-lg mt-1">
                    你也能继续拿钱（+{stats.indirectReward}元/人 + 授课奖励）
                  </p>
                </div>
              </div>
            </div>
            
            <div className="mt-4 pt-4 border-t border-amber-200">
              <p className="text-sm text-amber-800 flex items-center justify-center gap-2">
                <span>🎯</span>
                <span className="font-medium">邀请越多，收益越高，快去分享你的邀请链接吧！</span>
              </p>
            </div>
          </div>
        </div>
        
        {/* 邀请链接卡片 */}
        <div className="card mb-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">📤 分享邀请链接</h3>
          
          {/* 邀请链接 */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              邀请链接（分享给好友）
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={inviteUrl}
                readOnly
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 text-sm"
              />
              <button
                onClick={() => handleCopy(inviteUrl, 'invite')}
                className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-medium whitespace-nowrap"
              >
                {copiedType === 'invite' ? '✓ 已复制' : '复制链接'}
              </button>
            </div>
          </div>

          {/* 生成邀请海报按钮 */}
          <div className="mt-6 pt-6 border-t border-gray-200">
            <button
              onClick={() => setShowPosterGenerator(true)}
              className="w-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-medium py-3 px-6 rounded-lg transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2"
            >
              <span className="text-xl">🎨</span>
              <span>生成邀请海报</span>
            </button>
            <p className="text-xs text-gray-500 mt-2 text-center">
              一键生成精美海报，分享到朋友圈更方便
            </p>
          </div>
        </div>
        
        {/* 统计卡片 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          {/* 直接邀请统计 */}
          <div className="card bg-gradient-to-br from-blue-50 to-white">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-semibold text-gray-700">👥 直接邀请</h4>
              <div className="flex flex-col gap-1 text-right">
                <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full">
                  直接邀请：{stats.directReward}元/人
                </span>
                <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">
                  已授课：{stats.directTeachingReward}元/人
                </span>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <div className="text-2xl font-bold text-blue-600">{stats.directTotal}</div>
                <div className="text-xs text-gray-600 mt-1">总邀请</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-success-600">{stats.directValid}</div>
                <div className="text-xs text-gray-600 mt-1">有效邀请</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-green-600">{stats.directTaught}</div>
                <div className="text-xs text-gray-600 mt-1">已授课</div>
              </div>
            </div>
            <div className="mt-3 pt-3 border-t border-gray-200">
              <div className="text-sm text-gray-600">
                预计收益: <span className="font-bold text-blue-700">{stats.directValid * stats.directReward + stats.directTaught * stats.directTeachingReward}</span> 元
              </div>
            </div>
          </div>

          {/* 间接邀请统计 */}
          <div className="card bg-gradient-to-br from-purple-50 to-white">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-semibold text-gray-700">🔗 间接邀请</h4>
              <div className="flex flex-col gap-1 text-right">
                <span className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded-full">
                 间接邀请：{stats.indirectReward}元/人
                </span>
                <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">
                已授课：{stats.indirectTeachingReward}元/人
                </span>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <div className="text-2xl font-bold text-purple-600">{stats.indirectTotal}</div>
                <div className="text-xs text-gray-600 mt-1">总邀请</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-success-600">{stats.indirectValid}</div>
                <div className="text-xs text-gray-600 mt-1">有效邀请</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-green-600">{stats.indirectTaught}</div>
                <div className="text-xs text-gray-600 mt-1">已授课</div>
              </div>
            </div>
            <div className="mt-3 pt-3 border-t border-gray-200">
              <div className="text-sm text-gray-600">
                预计收益: <span className="font-bold text-purple-700">{stats.indirectValid * stats.indirectReward + stats.indirectTaught * stats.indirectTeachingReward}</span> 元
              </div>
            </div>
          </div>

          {/* 收益统计 */}
          <div className="card bg-gradient-to-br from-amber-50 to-white">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-semibold text-gray-700">💰 收益统计</h4>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-xs text-gray-600">总收益</span>
                <span className="text-lg font-bold text-gray-900">{stats.totalEarnings}元</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-gray-600">已提现</span>
                <span className="text-sm text-gray-700">{stats.totalWithdrawn}元</span>
              </div>
              {stats.totalPending > 0 && (
                <div className="flex justify-between items-center">
                  <span className="text-xs text-gray-600">待审核</span>
                  <span className="text-sm text-amber-600">{stats.totalPending}元</span>
                </div>
              )}
              <div className="pt-2 border-t border-gray-200">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-gray-700">可提现</span>
                  <span className="text-2xl font-bold text-amber-600">{stats.availableBalance}元</span>
                </div>
              </div>
            </div>
            <button
              onClick={() => router.push('/referral/withdraw')}
              className="mt-3 w-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-medium py-2.5 px-4 rounded-lg transition-all shadow-md hover:shadow-lg text-sm"
            >
              💳 申请提现
            </button>
          </div>
        </div>

        {/* 被邀请人列表 */}
        <div className="card">
          {/* Tab 切换 */}
          <div className="border-b border-gray-200 mb-6">
            <div className="flex gap-1">
              <button
                onClick={() => handleTabChange('direct')}
                className={`px-6 py-3 font-medium text-sm transition-colors relative ${
                  activeTab === 'direct'
                    ? 'text-primary-600'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <span className="flex items-center gap-2">
                  👥 直接邀请列表
                  <span className={`px-2 py-0.5 rounded-full text-xs ${
                    activeTab === 'direct' 
                      ? 'bg-primary-100 text-primary-700' 
                      : 'bg-gray-100 text-gray-600'
                  }`}>
                    {stats.directTotal}
                  </span>
                </span>
                {activeTab === 'direct' && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary-600" />
                )}
              </button>
              <button
                onClick={() => handleTabChange('indirect')}
                className={`px-6 py-3 font-medium text-sm transition-colors relative ${
                  activeTab === 'indirect'
                    ? 'text-primary-600'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <span className="flex items-center gap-2">
                  🔗 间接邀请列表
                  <span className={`px-2 py-0.5 rounded-full text-xs ${
                    activeTab === 'indirect' 
                      ? 'bg-primary-100 text-primary-700' 
                      : 'bg-gray-100 text-gray-600'
                  }`}>
                    {stats.indirectTotal}
                  </span>
                </span>
                {activeTab === 'indirect' && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary-600" />
                )}
              </button>
            </div>
          </div>

          {/* 列表头部 */}
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-gray-900">
              {activeTab === 'direct' ? '👥 直接邀请详情' : '🔗 间接邀请详情'}
            </h3>
            {pagination && (
              <div className="text-sm text-gray-600">
                共 {activeTab === 'direct' ? directReferrals.length : indirectReferrals.length} 条记录
              </div>
            )}
          </div>
          
          {/* 直接邀请列表 */}
          {activeTab === 'direct' && (
            <>
              {directReferrals.length === 0 ? (
                <div className="text-center py-12">
                  <div className="text-6xl mb-4">🎯</div>
                  <p className="text-gray-600 mb-2">还没有人通过你的邀请加入</p>
                  <p className="text-sm text-gray-500">快去分享你的邀请链接吧！</p>
                </div>
              ) : (
                <>
                  {/* 桌面端表格 */}
                  <div className="hidden md:block overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-gray-200">
                          <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">序号</th>
                          <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">被邀请人</th>
                          <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">任务进度</th>
                          <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">完成状态</th>
                          <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">邀请状态</th>
                          <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">注册时间</th>
                        </tr>
                      </thead>
                      <tbody>
                        {paginatedDirectReferrals.map((referral) => (
                      <tr key={referral.id} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="py-3 px-4 text-sm">#{referral.index}</td>
                        <td className="py-3 px-4 text-sm">
                          <div className="font-medium">
                            {referral.referredName ? formatName(referral.referredName) : `被邀请人 #${referral.index}`}
                          </div>
                          {referral.referredPhone && (
                            <div className="text-xs text-gray-500 mt-0.5">
                              {formatPhone(referral.referredPhone)}
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-4 text-sm">
                          第 {referral.currentTaskIndex}/6 个任务
                        </td>
                        <td className="py-3 px-4 text-sm">
                          {referral.status === 'COMPLETED' || referral.status === 'UNLOCKED' ? (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-success-100 text-success-800">
                              ✓ 已完成
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                              进行中
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-sm">
                          {referral.referralStatus === 'PENDING' ? (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
                              ⏳ 待审核
                            </span>
                          ) : referral.referralStatus === 'VALID' ? (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-success-100 text-success-800">
                              ✅ 有效
                            </span>
                          ) : (
                            <div className="group relative">
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 cursor-help">
                                ❌ 无效
                              </span>
                              {referral.adminNote && (
                                <div className="hidden group-hover:block absolute z-10 w-64 p-2 bg-gray-900 text-white text-xs rounded shadow-lg -top-2 left-full ml-2">
                                  原因：{referral.adminNote}
                                </div>
                              )}
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-4 text-sm text-gray-600">
                          {formatDateTime(referral.createdAt)}
                        </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              
                {/* 移动端卡片 */}
                <div className="md:hidden space-y-4">
                  {directReferrals.map((referral) => (
                  <div key={referral.id} className="p-4 border border-gray-200 rounded-lg">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <div className="font-medium text-gray-900">
                          {referral.referredName ? formatName(referral.referredName) : `被邀请人 #${referral.index}`}
                        </div>
                        {referral.referredPhone && (
                          <div className="text-xs text-gray-500 mt-0.5">
                            {formatPhone(referral.referredPhone)}
                          </div>
                        )}
                      </div>
                      <div className="flex gap-2">
                        {referral.referralStatus === 'PENDING' ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
                            ⏳ 待审核
                          </span>
                        ) : referral.referralStatus === 'VALID' ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-success-100 text-success-800">
                            ✅ 有效
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                            ❌ 无效
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="space-y-2 text-sm text-gray-600">
                      <div>进度：第 {referral.currentTaskIndex}/6 个任务</div>
                      <div>
                        状态：
                        {referral.status === 'COMPLETED' || referral.status === 'UNLOCKED' ? (
                          <span className="text-success-700 font-medium">✓ 已完成</span>
                        ) : (
                          <span className="text-blue-700 font-medium">进行中</span>
                        )}
                      </div>
                      <div className="text-xs">
                        注册：{formatDateTime(referral.createdAt)}
                      </div>
                      {referral.adminNote && referral.referralStatus === 'INVALID' && (
                        <div className="mt-2 p-2 bg-warning-50 border border-warning-200 rounded text-xs">
                          <strong>无效原因：</strong>{referral.adminNote}
                        </div>
                      )}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
            
            {/* 直接邀请分页控件 */}
            {directReferrals.length > pageSize && (
              <div className="mt-6 pt-6 border-t border-gray-200">
                <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                  <div className="text-sm text-gray-600">
                    显示 {(directPage - 1) * pageSize + 1} - {Math.min(directPage * pageSize, directReferrals.length)} 条，
                    共 {directReferrals.length} 条记录
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setDirectPage(1)}
                      disabled={directPage === 1}
                      className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors"
                    >
                      首页
                    </button>
                    <button
                      onClick={() => setDirectPage(p => Math.max(1, p - 1))}
                      disabled={directPage === 1}
                      className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors"
                    >
                      上一页
                    </button>
                    <span className="px-4 py-1.5 text-sm text-gray-700">
                      第 {directPage} / {directTotalPages} 页
                    </span>
                    <button
                      onClick={() => setDirectPage(p => Math.min(directTotalPages, p + 1))}
                      disabled={directPage === directTotalPages}
                      className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors"
                    >
                      下一页
                    </button>
                    <button
                      onClick={() => setDirectPage(directTotalPages)}
                      disabled={directPage === directTotalPages}
                      className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors"
                    >
                      末页
                    </button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

          {/* 间接邀请列表 */}
          {activeTab === 'indirect' && (
            <>
              {indirectReferrals.length === 0 ? (
                <div className="text-center py-12">
                  <div className="text-6xl mb-4">🔗</div>
                  <p className="text-gray-600 mb-2">暂无间接邀请记录</p>
                  <p className="text-sm text-gray-500">
                    当你邀请的人再邀请其他人时，会产生间接邀请
                  </p>
                </div>
              ) : (
                <>
                  {/* 桌面端表格 */}
                  <div className="hidden md:block overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-gray-200">
                          <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">序号</th>
                          <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">邀请人</th>
                          <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">被邀请人</th>
                          <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">任务进度</th>
                          <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">完成状态</th>
                          <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">邀请状态</th>
                          <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">注册时间</th>
                        </tr>
                      </thead>
                      <tbody>
                        {paginatedIndirectReferrals.map((referral) => (
                          <tr key={referral.id} className="border-b border-gray-100 hover:bg-gray-50">
                            <td className="py-3 px-4 text-sm">#{referral.index}</td>
                            <td className="py-3 px-4 text-sm">
                              <div className="flex items-center gap-2">
                                <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded">中间人</span>
                                <span className="font-medium text-gray-900">
                                  {referral.referrerName ? formatName(referral.referrerName) : '未知'}
                                </span>
                              </div>
                            </td>
                            <td className="py-3 px-4 text-sm">
                              <div className="font-medium">
                                {referral.referredName ? formatName(referral.referredName) : `被邀请人 #${referral.index}`}
                              </div>
                              {referral.referredPhone && (
                                <div className="text-xs text-gray-500 mt-0.5">
                                  {formatPhone(referral.referredPhone)}
                                </div>
                              )}
                            </td>
                            <td className="py-3 px-4 text-sm">
                              第 {referral.currentTaskIndex}/6 个任务
                            </td>
                            <td className="py-3 px-4 text-sm">
                              {referral.status === 'COMPLETED' || referral.status === 'UNLOCKED' ? (
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-success-100 text-success-800">
                                  ✓ 已完成
                                </span>
                              ) : (
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                  进行中
                                </span>
                              )}
                            </td>
                            <td className="py-3 px-4 text-sm">
                              {referral.referralStatus === 'PENDING' ? (
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
                                  ⏳ 待审核
                                </span>
                              ) : referral.referralStatus === 'VALID' ? (
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-success-100 text-success-800">
                                  ✅ 有效
                                </span>
                              ) : (
                                <div className="group relative">
                                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 cursor-help">
                                    ❌ 无效
                                  </span>
                                  {referral.adminNote && (
                                    <div className="hidden group-hover:block absolute z-10 w-64 p-2 bg-gray-900 text-white text-xs rounded shadow-lg -top-2 left-full ml-2">
                                      原因：{referral.adminNote}
                                    </div>
                                  )}
                                </div>
                              )}
                            </td>
                            <td className="py-3 px-4 text-sm text-gray-600">
                              {formatDateTime(referral.createdAt)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
              
                  {/* 移动端卡片 */}
                  <div className="md:hidden space-y-4">
                    {indirectReferrals.map((referral) => (
                      <div key={referral.id} className="p-4 border border-purple-200 rounded-lg bg-purple-50/30">
                        <div className="flex items-center gap-2 mb-3">
                          <span className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded font-medium">
                            🔗 间接邀请
                          </span>
                          <span className="text-xs text-gray-600">
                            通过 {referral.referrerName ? formatName(referral.referrerName) : '未知'} 邀请
                          </span>
                        </div>
                        <div className="flex justify-between items-start mb-3">
                          <div>
                            <div className="font-medium text-gray-900">
                              {referral.referredName ? formatName(referral.referredName) : `被邀请人 #${referral.index}`}
                            </div>
                            {referral.referredPhone && (
                              <div className="text-xs text-gray-500 mt-0.5">
                                {formatPhone(referral.referredPhone)}
                              </div>
                            )}
                          </div>
                          <div className="flex gap-2">
                            {referral.referralStatus === 'PENDING' ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
                                ⏳ 待审核
                              </span>
                            ) : referral.referralStatus === 'VALID' ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-success-100 text-success-800">
                                ✅ 有效
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                                ❌ 无效
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="space-y-2 text-sm text-gray-600">
                          <div>进度：第 {referral.currentTaskIndex}/6 个任务</div>
                          <div>
                            状态：
                            {referral.status === 'COMPLETED' || referral.status === 'UNLOCKED' ? (
                              <span className="text-success-700 font-medium">✓ 已完成</span>
                            ) : (
                              <span className="text-blue-700 font-medium">进行中</span>
                            )}
                          </div>
                          <div className="text-xs">
                            注册：{formatDateTime(referral.createdAt)}
                          </div>
                          {referral.adminNote && referral.referralStatus === 'INVALID' && (
                            <div className="mt-2 p-2 bg-warning-50 border border-warning-200 rounded text-xs">
                              <strong>无效原因：</strong>{referral.adminNote}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            
            {/* 间接邀请分页控件 */}
            {indirectReferrals.length > pageSize && (
              <div className="mt-6 pt-6 border-t border-gray-200">
                <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                  <div className="text-sm text-gray-600">
                    显示 {(indirectPage - 1) * pageSize + 1} - {Math.min(indirectPage * pageSize, indirectReferrals.length)} 条，
                    共 {indirectReferrals.length} 条记录
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setIndirectPage(1)}
                      disabled={indirectPage === 1}
                      className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors"
                    >
                      首页
                    </button>
                    <button
                      onClick={() => setIndirectPage(p => Math.max(1, p - 1))}
                      disabled={indirectPage === 1}
                      className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors"
                    >
                      上一页
                    </button>
                    <span className="px-4 py-1.5 text-sm text-gray-700">
                      第 {indirectPage} / {indirectTotalPages} 页
                    </span>
                    <button
                      onClick={() => setIndirectPage(p => Math.min(indirectTotalPages, p + 1))}
                      disabled={indirectPage === indirectTotalPages}
                      className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors"
                    >
                      下一页
                    </button>
                    <button
                      onClick={() => setIndirectPage(indirectTotalPages)}
                      disabled={indirectPage === indirectTotalPages}
                      className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors"
                    >
                      末页
                    </button>
                  </div>
                </div>
              </div>
            )}
            </>
          )}
        </div>
        
        {/* 返回首页链接 */}
        <div className="mt-6 text-center">
          <a
            href="/onboarding"
            className="inline-flex items-center text-primary-600 hover:text-primary-700 font-medium"
          >
            ← 返回引导页面
          </a>
        </div>
      </div>

      {/* 海报生成器 Modal */}
      {showPosterGenerator && (
        <PosterGenerator
          inviteUrl={inviteUrl}
          referrerName={referrerName}
          onClose={() => setShowPosterGenerator(false)}
        />
      )}
    </div>
  )
}
