'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { updateReferralStatus, markRewardSent } from '@/app/actions/referral'

type Referral = {
  id: string
  status: 'VALID' | 'INVALID'
  rewardSent: boolean
  adminNote: string | null
  createdAt: Date
  referred: {
    id: string
    name: string | null
    phone: string | null
    currentTaskIndex: number
    currentPhase: number
    status: string
    createdAt: Date
  }
}

type ReferralListProps = {
  referrals: Referral[]
  teacherName: string | null
}

export default function ReferralList({ referrals, teacherName }: ReferralListProps) {
  const router = useRouter()
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

  if (referrals.length === 0) {
    return (
      <div className="bg-gray-50 rounded-lg p-6 text-center">
        <div className="text-gray-400 text-3xl mb-2">📭</div>
        <p className="text-sm text-gray-600">
          {teacherName || '该老师'}还没有邀请记录
        </p>
      </div>
    )
  }

  return (
    <div className="bg-gray-50 rounded-lg p-4">
      <h4 className="text-sm font-semibold text-gray-700 mb-3">
        📋 TA 的邀请记录（共 {referrals.length} 条）
      </h4>
      <div className="space-y-3">
        {referrals.map((referral) => (
          <div key={referral.id} className="bg-white rounded-lg p-4 border border-gray-200">
            <div className="flex items-start justify-between mb-2">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-lg">👤</span>
                  <span className="font-medium text-gray-900">
                    {referral.referred.name || '未填写'}
                  </span>
                  {referral.referred.phone && (
                    <span className="text-xs text-gray-500">
                      ({referral.referred.phone})
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2 text-xs text-gray-600 ml-7">
                  <span>进度: {referral.referred.currentTaskIndex}/6</span>
                  <span>•</span>
                  <span>
                    {referral.referred.status === 'COMPLETED' || referral.referred.status === 'UNLOCKED' ? (
                      <span className="text-success-600">✓ 已完成</span>
                    ) : (
                      <span className="text-blue-600">进行中</span>
                    )}
                  </span>
                  <span>•</span>
                  {referral.status === 'VALID' ? (
                    <span className="text-success-600">✅ 有效</span>
                  ) : (
                    <span className="text-warning-600">❌ 无效</span>
                  )}
                  <span>•</span>
                  {referral.rewardSent ? (
                    <span className="text-blue-600">✅ 已发奖励</span>
                  ) : (
                    <span className="text-gray-600">⏳ 待发奖励</span>
                  )}
                </div>
                <div className="text-xs text-gray-500 ml-7 mt-1">
                  邀请时间: {new Date(referral.createdAt).toLocaleString('zh-CN')}
                </div>
                {referral.adminNote && (
                  <div className="ml-7 mt-2 p-2 bg-amber-50 border border-amber-200 rounded text-xs text-amber-800">
                    备注: {referral.adminNote}
                  </div>
                )}
              </div>
            </div>
            
            <div className="flex gap-2 ml-7 mt-3">
              {referral.status === 'VALID' ? (
                <button
                  onClick={() => handleMarkInvalid(referral.id)}
                  disabled={isLoading}
                  className="text-xs px-3 py-1 bg-warning-100 text-warning-700 rounded hover:bg-warning-200 disabled:opacity-50 transition-colors"
                >
                  标记无效
                </button>
              ) : (
                <button
                  onClick={() => handleMarkValid(referral.id)}
                  disabled={isLoading}
                  className="text-xs px-3 py-1 bg-success-100 text-success-700 rounded hover:bg-success-200 disabled:opacity-50 transition-colors"
                >
                  恢复有效
                </button>
              )}
              {!referral.rewardSent && referral.status === 'VALID' && (
                <button
                  onClick={() => handleMarkRewardSent(referral.id)}
                  disabled={isLoading}
                  className="text-xs px-3 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 disabled:opacity-50 transition-colors"
                >
                  标记已发放
                </button>
              )}
              <Link
                href={`/admin/referrals/${referral.id}`}
                className="text-xs px-3 py-1 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors"
              >
                详情
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
