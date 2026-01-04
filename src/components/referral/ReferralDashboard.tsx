'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import dynamic from 'next/dynamic'
import { formatName, formatPhone } from '@/lib/utils'
import { logoutReferrer } from '@/app/actions/auth'

const PosterGenerator = dynamic(() => import('@/components/referral/PosterGenerator'), {
  ssr: false
})

type ReferralData = {
  referrerName: string | null
  inviteCode: string | null
  stats: {
    total: number
    validReferrals: number
    totalWithdrawn: number
    totalPending: number
    availableBalance: number
  }
  referrals: Array<{
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
  const { referrerName, inviteCode, stats, referrals } = data
  const [copiedType, setCopiedType] = useState<'invite' | null>(null)
  const [showPosterGenerator, setShowPosterGenerator] = useState(false)

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

  // 翻页
  const goToPage = (page: number) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set('page', page.toString())
    router.push(`?${params.toString()}`)
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
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            {referrerName ? `${referrerName}的邀请看板` : '我的邀请看板'}
          </h1>
          <p className="text-gray-600">
            邀请好友加入伴学团队，完成【有效邀请】即可获得奖励
          </p>
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
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="card text-center">
            <div className="text-3xl font-bold text-primary-600">{stats.total}</div>
            <div className="text-sm text-gray-600 mt-1">总邀请人数</div>
          </div>
          <div className="card text-center">
            <div className="text-3xl font-bold text-success-600">{stats.validReferrals}</div>
            <div className="text-sm text-gray-600 mt-1">总有效邀请数</div>
          </div>
          <div className="card text-center">
            <div className="text-3xl font-bold text-blue-600">{stats.totalWithdrawn}</div>
            <div className="text-sm text-gray-600 mt-1">已累计提现（元）</div>
          </div>
          <div className="card text-center relative">
            <div className="text-3xl font-bold text-amber-600">{stats.availableBalance}</div>
            <div className="text-sm text-gray-600 mt-1">可提现金额（元）</div>
            <button
              onClick={() => router.push('/referral/withdraw')}
              className="mt-3 w-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-medium py-2 px-4 rounded-lg transition-all shadow-md hover:shadow-lg text-sm"
            >
              💰 申请提现
            </button>
          </div>
        </div>

        {/* 筛选表单 */}
        <div className="card mb-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">🔍 筛选条件</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* 开始日期 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                开始日期
              </label>
              <input
                type="date"
                value={filterForm.startDate}
                onChange={(e) => setFilterForm(prev => ({ ...prev, startDate: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm"
              />
            </div>

            {/* 结束日期 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                结束日期
              </label>
              <input
                type="date"
                value={filterForm.endDate}
                onChange={(e) => setFilterForm(prev => ({ ...prev, endDate: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm"
              />
            </div>

            {/* 任务进度 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                任务进度
              </label>
              <select
                value={filterForm.taskStatus}
                onChange={(e) => setFilterForm(prev => ({ ...prev, taskStatus: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm"
              >
                <option value="">全部</option>
                <option value="0">0/6</option>
                <option value="1">1/6</option>
                <option value="2">2/6</option>
                <option value="3">3/6</option>
                <option value="4">4/6</option>
                <option value="5">5/6</option>
                <option value="6">6/6</option>
              </select>
            </div>

            {/* 邀请状态 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                邀请状态
              </label>
              <select
                value={filterForm.referralStatus}
                onChange={(e) => setFilterForm(prev => ({ ...prev, referralStatus: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm"
              >
                <option value="">全部</option>
                <option value="PENDING">待审核</option>
                <option value="VALID">有效邀请</option>
                <option value="INVALID">无效邀请</option>
              </select>
            </div>
          </div>

          {/* 筛选按钮 */}
          <div className="mt-4 flex gap-3">
            <button
              onClick={applyFilters}
              className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-medium"
            >
              应用筛选
            </button>
            <button
              onClick={clearFilters}
              className="px-6 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium"
            >
              清除筛选
            </button>
          </div>
        </div>
        
        {/* 被邀请人列表 */}
        <div className="card">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-gray-900">👥 被邀请人列表</h3>
            {pagination && (
              <div className="text-sm text-gray-600">
                共 {pagination.totalCount} 条记录
              </div>
            )}
          </div>
          
          {referrals.length === 0 ? (
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
                    {referrals.map((referral) => (
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
                          {new Date(referral.createdAt).toLocaleDateString('zh-CN')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              
              {/* 移动端卡片 */}
              <div className="md:hidden space-y-4">
                {referrals.map((referral) => (
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
                        注册：{new Date(referral.createdAt).toLocaleDateString('zh-CN')}
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

          {/* 分页控件 */}
          {pagination && pagination.totalPages > 1 && (
            <div className="mt-6 pt-6 border-t border-gray-200">
              <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                {/* 分页信息 */}
                <div className="text-sm text-gray-600">
                  第 {pagination.currentPage} / {pagination.totalPages} 页
                  （共 {pagination.totalCount} 条记录）
                </div>

                {/* 分页按钮 */}
                <div className="flex gap-2">
                  <button
                    onClick={() => goToPage(1)}
                    disabled={!pagination.hasPrevPage}
                    className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors"
                  >
                    首页
                  </button>
                  <button
                    onClick={() => goToPage(pagination.currentPage - 1)}
                    disabled={!pagination.hasPrevPage}
                    className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors"
                  >
                    上一页
                  </button>
                  <button
                    onClick={() => goToPage(pagination.currentPage + 1)}
                    disabled={!pagination.hasNextPage}
                    className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors"
                  >
                    下一页
                  </button>
                  <button
                    onClick={() => goToPage(pagination.totalPages)}
                    disabled={!pagination.hasNextPage}
                    className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors"
                  >
                    末页
                  </button>
                </div>

                {/* 快速跳转 */}
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-600">跳转到</span>
                  <input
                    type="number"
                    min={1}
                    max={pagination.totalPages}
                    defaultValue={pagination.currentPage}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        const page = parseInt(e.currentTarget.value)
                        if (page >= 1 && page <= pagination.totalPages) {
                          goToPage(page)
                        }
                      }
                    }}
                    className="w-16 px-2 py-1.5 border border-gray-300 rounded-lg text-sm text-center"
                  />
                  <span className="text-sm text-gray-600">页</span>
                </div>
              </div>
            </div>
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
