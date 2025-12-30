'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { updateReferralStatus, markRewardSent } from '@/app/actions/referral'
import Link from 'next/link'

type Referral = {
  id: string
  status: 'VALID' | 'INVALID'
  rewardSent: boolean
  adminNote: string | null
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
    createdAt: Date
  }
}

export default function ReferralManagementClient({
  initialReferrals,
  initialStats
}: {
  initialReferrals: any[]
  initialStats: any
}) {
  const router = useRouter()
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
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
  
  // 应用筛选
  const handleApplyFilters = () => {
    const params = new URLSearchParams()
    if (statusFilter !== 'all') params.set('status', statusFilter)
    if (searchTerm) params.set('search', searchTerm)
    
    router.push(`/admin/referrals?${params.toString()}`)
  }
  
  return (
    <div className="bg-white rounded-lg shadow">
      {/* 筛选和搜索 */}
      <div className="p-4 border-b border-gray-200">
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
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
          >
            <option value="all">全部状态</option>
            <option value="valid">有效邀请</option>
            <option value="invalid">无效邀请</option>
          </select>
          <button
            onClick={handleApplyFilters}
            className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
          >
            筛选
          </button>
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
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">奖励状态</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">邀请时间</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">操作</th>
              </tr>
            </thead>
            <tbody>
              {initialReferrals.map((referral) => (
                <tr key={referral.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="py-3 px-4 text-sm">
                    <div className="font-medium">{referral.referrer.name || '未填写'}</div>
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
                    {referral.status === 'VALID' ? (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-success-100 text-success-800">
                        ✅ 有效
                      </span>
                    ) : (
                      <div className="group relative">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-warning-100 text-warning-800 cursor-help">
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
                    {new Date(referral.createdAt).toLocaleDateString('zh-CN')}
                  </td>
                  <td className="py-3 px-4 text-sm">
                    <div className="flex gap-2">
                      {referral.status === 'VALID' ? (
                        <button
                          onClick={() => handleMarkInvalid(referral.id)}
                          disabled={isLoading}
                          className="text-xs px-2 py-1 bg-warning-100 text-warning-700 rounded hover:bg-warning-200 disabled:opacity-50"
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
    </div>
  )
}
