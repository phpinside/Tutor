'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { updateReferralStatus, markRewardSent, markTeachingCompleted } from '@/app/actions/referral'
import Link from 'next/link'
import { formatDateTime } from '@/lib/utils'

type Referral = {
  id: string
  status: 'PENDING' | 'VALID' | 'INVALID'
  rewardSent: boolean
  adminNote: string | null
  lessonNote: string | null
  createdAt: Date
  referrer: {
    id: string
    name: string | null
    phone: string | null
  }
  referred: {
    id: string
    name: string | null
    phone: string | null
    currentPhase: number
    currentTaskIndex: number
    status: string
    teachingStatus: string
    createdAt: Date
  }
}

export default function ReferralManagementClient({
  initialReferrals,
  initialStats,
  initialFilters,
  pagination
}: {
  initialReferrals: any[]
  initialStats: any
  initialFilters?: {
    status?: string
    search?: string
    inviteCode?: string
    startDate?: string
    endDate?: string
    taskProgress?: string
    rewardStatus?: string
    teachingStatus?: string
  }
  pagination?: {
    currentPage: number
    totalPages: number
    totalCount: number
    pageSize: number
    hasNextPage: boolean
    hasPrevPage: boolean
  }
}) {
  const router = useRouter()
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [searchTerm, setSearchTerm] = useState(initialFilters?.search || '')
  const [statusFilter, setStatusFilter] = useState<string>(initialFilters?.status || 'all')
  const [inviteCode, setInviteCode] = useState(initialFilters?.inviteCode || '')
  const [startDate, setStartDate] = useState(initialFilters?.startDate || '')
  const [endDate, setEndDate] = useState(initialFilters?.endDate || '')
  const [taskProgress, setTaskProgress] = useState(initialFilters?.taskProgress || '')
  const [rewardStatus, setRewardStatus] = useState(initialFilters?.rewardStatus || '')
  const [teachingStatus, setTeachingStatus] = useState(initialFilters?.teachingStatus || '')
  const [isLoading, setIsLoading] = useState(false)
  
  // 处理标记无效
  const handleMarkInvalid = async (referralId: string) => {
    const reason = prompt('请输入标记为无效的理由：')
    if (!reason) return
    
    setIsLoading(true)
    const result = await updateReferralStatus(referralId, 'INVALID', reason)
    setIsLoading(false)
    
    if (result.success) {
      alert('已标记为无效邀请')
      router.refresh()
    } else {
      alert('操作失败：' + result.error)
    }
  }
  
  // 处理恢复有效
  const handleMarkValid = async (referralId: string) => {
    if (!confirm('确定要恢复为有效邀请吗？')) return
    
    setIsLoading(true)
    const result = await updateReferralStatus(referralId, 'VALID')
    setIsLoading(false)
    
    if (result.success) {
      alert('已恢复为有效邀请')
      router.refresh()
    } else {
      alert('操作失败：' + result.error)
    }
  }
  
  // 处理标记已发放奖励
  const handleMarkRewardSent = async (referralId: string) => {
    if (!confirm('确定已发放奖励吗？此操作不可撤销。')) return
    
    setIsLoading(true)
    const result = await markRewardSent(referralId)
    setIsLoading(false)
    
    if (result.success) {
      alert('已标记为已发放奖励')
      router.refresh()
    } else {
      alert('操作失败：' + result.error)
    }
  }
  
  // 处理标记授课完成
  const handleMarkTeachingCompleted = async (referralId: string) => {
    const lessonNote = prompt('请填写授课备注（必填）：')
    if (!lessonNote?.trim()) {
      alert('授课备注不能为空')
      return
    }
    
    if (!confirm('确认该老师已完成首次授课？')) return
    
    setIsLoading(true)
    const result = await markTeachingCompleted(referralId, lessonNote)
    setIsLoading(false)
    
    if (result.success) {
      alert('已标记为授课完成')
      router.refresh()
    } else {
      alert('操作失败：' + result.error)
    }
  }
  
  // 应用筛选
  const handleApplyFilters = () => {
    const params = new URLSearchParams()
    if (statusFilter !== 'all') params.set('status', statusFilter)
    if (searchTerm) params.set('search', searchTerm)
    if (inviteCode) params.set('inviteCode', inviteCode)
    if (startDate) params.set('startDate', startDate)
    if (endDate) params.set('endDate', endDate)
    if (taskProgress) params.set('taskProgress', taskProgress)
    if (rewardStatus) params.set('rewardStatus', rewardStatus)
    if (teachingStatus) params.set('teachingStatus', teachingStatus)
    
    router.push(`/admin/referrals?${params.toString()}`)
  }
  
  // 重置筛选
  const handleReset = () => {
    setSearchTerm('')
    setStatusFilter('all')
    setInviteCode('')
    setStartDate('')
    setEndDate('')
    setTaskProgress('')
    setRewardStatus('')
    setTeachingStatus('')
    router.push('/admin/referrals')
  }
  
  // 翻页
  const goToPage = (page: number) => {
    const params = new URLSearchParams()
    params.set('page', page.toString())
    if (statusFilter !== 'all') params.set('status', statusFilter)
    if (searchTerm) params.set('search', searchTerm)
    if (inviteCode) params.set('inviteCode', inviteCode)
    if (startDate) params.set('startDate', startDate)
    if (endDate) params.set('endDate', endDate)
    if (taskProgress) params.set('taskProgress', taskProgress)
    if (rewardStatus) params.set('rewardStatus', rewardStatus)
    if (teachingStatus) params.set('teachingStatus', teachingStatus)
    
    router.push(`/admin/referrals?${params.toString()}`)
  }
  
  return (
    <div className="bg-white rounded-lg shadow">
      {/* 筛选和搜索 */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex flex-col gap-4">
          {/* 第一行：搜索框、邀请码、邀请状态、重置 */}
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <input
                type="text"
                placeholder="搜索邀请人或被邀请人姓名/手机号..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleApplyFilters()}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>
            <input
              type="text"
              placeholder="搜索邀请码..."
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleApplyFilters()}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent md:w-48"
            />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
            >
              <option value="all">邀请状态（全部）</option>
              <option value="pending">待审核</option>
              <option value="valid">有效邀请</option>
              <option value="invalid">无效邀请</option>
            </select>
            <button
              onClick={handleReset}
              className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors whitespace-nowrap"
            >
              重置
            </button>
          </div>
          
          {/* 第二行：任务进度、完成状态、奖励状态、授课状态 */}
          <div className="flex flex-col md:flex-row gap-4">
            <select
              value={taskProgress}
              onChange={(e) => setTaskProgress(e.target.value)}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
            >
              <option value="">任务进度（全部）</option>
              <option value="0">任务 0/6</option>
              <option value="1">任务 1/6</option>
              <option value="2">任务 2/6</option>
              <option value="3">任务 3/6</option>
              <option value="4">任务 4/6</option>
              <option value="5">任务 5/6</option>
              <option value="6">任务 6/6</option>
            </select>
            <select
              value={rewardStatus}
              onChange={(e) => setRewardStatus(e.target.value)}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
            >
              <option value="">奖励状态（全部）</option>
              <option value="pending">待发放</option>
              <option value="sent">已发放</option>
            </select>
            <select
              value={teachingStatus}
              onChange={(e) => setTeachingStatus(e.target.value)}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
            >
              <option value="">授课状态（全部）</option>
              <option value="not_taught">未授课</option>
              <option value="taught">已授课</option>
            </select>
          </div>
          
          {/* 第三行：邀请时间区间、筛选按钮 */}
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 flex flex-col sm:flex-row items-start sm:items-center gap-2">
              <label className="text-sm text-gray-600 whitespace-nowrap">邀请时间：</label>
              <div className="flex items-center gap-2 flex-1 w-full">
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 text-sm"
                />
                <span className="text-gray-500">-</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 text-sm"
                />
              </div>
            </div>
            <button
              onClick={handleApplyFilters}
              className="px-8 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors whitespace-nowrap"
            >
              筛选
            </button>
          </div>
        </div>
      </div>
      
      {/* 邀请列表 */}
      <div className="overflow-x-auto">
        {initialReferrals.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            暂无邀请记录
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">邀请人</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">被邀请人</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">任务进度</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">完成状态</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">邀请状态</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">授课状态</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">奖励状态</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">邀请时间</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">操作</th>
              </tr>
            </thead>
            <tbody>
              {initialReferrals.map((referral) => (
                <tr key={referral.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="py-3 px-4 text-sm">
                    <div className="font-medium mb-1">{referral.referrer.name || '未填写'}</div>
                    <div className="text-xs text-gray-500">{referral.referrer.phone || '-'}</div>
                  </td>
                  <td className="py-3 px-4 text-sm">
                    <div className="font-medium">{referral.referred.name || '未填写'}</div>
                    <div className="text-xs text-gray-500">{referral.referred.phone || '-'}</div>
                  </td>
                  <td className="py-3 px-4 text-sm">
                    第 {referral.referred.currentTaskIndex}/6 个任务
                  </td>
                  <td className="py-3 px-4 text-sm">
                    {referral.referred.status === 'COMPLETED' || referral.referred.status === 'UNLOCKED' ? (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-success-100 text-success-800">
                        已完成
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        进行中
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-sm">
                    {referral.status === 'PENDING' ? (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
                        ⏳ 待审核
                      </span>
                    ) : referral.status === 'VALID' ? (
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
                            {referral.adminNote}
                          </div>
                        )}
                      </div>
                    )}
                  </td>
                  <td className="py-3 px-4 text-sm">
                    {referral.referred.teachingStatus === 'TAUGHT' ? (
                      <div className="group relative">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 cursor-help">
                          ✓ 已授课
                        </span>
                        {referral.lessonNote && (
                          <div className="hidden group-hover:block absolute z-10 w-64 p-2 bg-gray-900 text-white text-xs rounded shadow-lg -top-2 left-full ml-2">
                            {referral.lessonNote}
                          </div>
                        )}
                      </div>
                    ) : (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                        未授课
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-sm">
                    {referral.rewardSent ? (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-success-100 text-success-800">
                        ✅ 已发放
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                        待发放
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-sm text-gray-600">
                    {formatDateTime(referral.createdAt)}
                  </td>
                  <td className="py-3 px-4 text-sm">
                    <div className="flex gap-2 flex-wrap">
                      {referral.status === 'PENDING' ? (
                        <>
                          <button
                            onClick={() => handleMarkValid(referral.id)}
                            disabled={isLoading}
                            className="text-xs px-2 py-1 bg-success-100 text-success-700 rounded hover:bg-success-200 disabled:opacity-50"
                          >
                            审核通过
                          </button>
                          <button
                            onClick={() => handleMarkInvalid(referral.id)}
                            disabled={isLoading}
                            className="text-xs px-2 py-1 bg-red-100 text-red-700 rounded hover:bg-red-200 disabled:opacity-50"
                          >
                            审核不通过
                          </button>
                        </>
                      ) : referral.status === 'VALID' ? (
                        <button
                          onClick={() => handleMarkInvalid(referral.id)}
                          disabled={isLoading}
                          className="text-xs px-2 py-1 bg-red-100 text-red-700 rounded hover:bg-red-200 disabled:opacity-50"
                        >
                          标记无效
                        </button>
                      ) : (
                        <button
                          onClick={() => handleMarkValid(referral.id)}
                          disabled={isLoading}
                          className="text-xs px-2 py-1 bg-success-100 text-success-700 rounded hover:bg-success-200 disabled:opacity-50"
                        >
                          恢复有效
                        </button>
                      )}
                      {referral.status === 'VALID' && referral.referred.teachingStatus === 'NOT_TAUGHT' && (
                        <button
                          onClick={() => handleMarkTeachingCompleted(referral.id)}
                          disabled={isLoading}
                          className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded hover:bg-green-200 disabled:opacity-50"
                        >
                          已完成授课
                        </button>
                      )}
                      {!referral.rewardSent && referral.status === 'VALID' && (
                        <button
                          onClick={() => handleMarkRewardSent(referral.id)}
                          disabled={isLoading}
                          className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 disabled:opacity-50"
                        >
                          标记已发放
                        </button>
                      )}
                      <Link
                        href={`/admin/referrals/${referral.id}`}
                        className="text-xs px-2 py-1 bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
                      >
                        详情
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      
      {/* 分页控件 */}
      {pagination && pagination.totalPages > 1 && (
        <div className="mt-6 pt-6 border-t border-gray-200">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="text-sm text-gray-600">
              显示 {(pagination.currentPage - 1) * pagination.pageSize + 1} - {Math.min(pagination.currentPage * pagination.pageSize, pagination.totalCount)} 条，
              共 {pagination.totalCount} 条记录
            </div>
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
              <span className="px-4 py-1.5 text-sm text-gray-700">
                第 {pagination.currentPage} / {pagination.totalPages} 页
              </span>
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
          </div>
        </div>
      )}
    </div>
  )
}
