'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { approveWithdrawal, rejectWithdrawal } from '@/app/actions/teacher'
import { formatDateTime } from '@/lib/utils'

type Withdrawal = {
  id: string
  amount: number
  accountName: string
  bankName: string
  cardNumber: string
  phone: string
  idCard: string
  status: 'PENDING' | 'APPROVED' | 'REJECTED'
  rejectNote: string | null
  reviewedBy: string | null
  reviewedAt: Date | null
  createdAt: Date
  teacher: {
    id: string
    name: string | null
    phone: string | null
    inviteCode: string | null
    createdAt: Date
  }
}

type ReferralStats = {
  directTotal: number
  directValid: number
  indirectTotal: number
  indirectValid: number
  totalEarnings: number
  totalWithdrawn: number
  pendingWithdrawal: number
  availableBalance: number
} | null

export default function WithdrawalDetailClient({
  withdrawal,
  stats,
  adminId
}: {
  withdrawal: Withdrawal
  stats: ReferralStats
  adminId: string
}) {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [showRejectModal, setShowRejectModal] = useState(false)
  const [rejectNote, setRejectNote] = useState('')

  const handleApprove = async () => {
    if (!confirm('确定批准此提现申请吗？')) return
    
    setIsLoading(true)
    const result = await approveWithdrawal(withdrawal.id, adminId)
    setIsLoading(false)
    
    if (result.success) {
      alert('已批准提现申请')
      router.push('/admin/withdrawals')
      router.refresh()
    } else {
      alert('操作失败：' + result.error)
    }
  }

  const handleReject = async () => {
    if (!rejectNote.trim()) {
      alert('请填写驳回原因')
      return
    }
    
    setIsLoading(true)
    const result = await rejectWithdrawal(withdrawal.id, adminId, rejectNote)
    setIsLoading(false)
    
    if (result.success) {
      alert('已驳回提现申请')
      setShowRejectModal(false)
      router.push('/admin/withdrawals')
      router.refresh()
    } else {
      alert('操作失败：' + result.error)
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PENDING':
        return <span className="px-3 py-1 rounded-full text-sm font-medium bg-amber-100 text-amber-800">待审核</span>
      case 'APPROVED':
        return <span className="px-3 py-1 rounded-full text-sm font-medium bg-success-100 text-success-800">已批准</span>
      case 'REJECTED':
        return <span className="px-3 py-1 rounded-full text-sm font-medium bg-red-100 text-red-800">已驳回</span>
      default:
        return null
    }
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* 返回按钮 */}
      <div className="mb-6">
        <button
          onClick={() => router.back()}
          className="text-primary-600 hover:text-primary-700 font-medium"
        >
          ← 返回列表
        </button>
      </div>

      {/* 提现申请详情 */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <div className="flex justify-between items-start mb-6">
          <h2 className="text-xl font-bold text-gray-900">提现申请详情</h2>
          {getStatusBadge(withdrawal.status)}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-4">提现信息</h3>
            <div className="space-y-3">
              <div>
                <div className="text-xs text-gray-500">提现金额</div>
                <div className="text-2xl font-bold text-amber-600">{withdrawal.amount} 元</div>
              </div>
              <div>
                <div className="text-xs text-gray-500">申请时间</div>
                <div className="text-sm">{formatDateTime(withdrawal.createdAt)}</div>
              </div>
              {withdrawal.reviewedAt && (
                <div>
                  <div className="text-xs text-gray-500">审核时间</div>
                  <div className="text-sm">{formatDateTime(withdrawal.reviewedAt)}</div>
                </div>
              )}
              {withdrawal.status === 'REJECTED' && withdrawal.rejectNote && (
                <div>
                  <div className="text-xs text-gray-500">驳回原因</div>
                  <div className="text-sm text-red-600">{withdrawal.rejectNote}</div>
                </div>
              )}
            </div>
          </div>

          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-4">银行账户信息</h3>
            <div className="space-y-3">
              <div>
                <div className="text-xs text-gray-500">账户名称</div>
                <div className="text-sm">{withdrawal.accountName}</div>
              </div>
              <div>
                <div className="text-xs text-gray-500">开户行</div>
                <div className="text-sm">{withdrawal.bankName}</div>
              </div>
              <div>
                <div className="text-xs text-gray-500">银行卡号</div>
                <div className="text-sm font-mono">{withdrawal.cardNumber}</div>
              </div>
              <div>
                <div className="text-xs text-gray-500">手机号</div>
                <div className="text-sm">{withdrawal.phone}</div>
              </div>
              <div>
                <div className="text-xs text-gray-500">身份证号</div>
                <div className="text-sm font-mono">{withdrawal.idCard}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 提现人信息 */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4">提现人信息</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-3">
            <div>
              <div className="text-xs text-gray-500">姓名</div>
              <div className="text-sm">{withdrawal.teacher.name || '未填写'}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500">手机号</div>
              <div className="text-sm">{withdrawal.teacher.phone || '未填写'}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500">邀请码</div>
              <div className="text-sm font-mono">{withdrawal.teacher.inviteCode || '-'}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500">注册时间</div>
              <div className="text-sm">{formatDateTime(withdrawal.teacher.createdAt)}</div>
            </div>
          </div>

          {stats && (
            <div className="space-y-3">
              <div>
                <div className="text-xs text-gray-500">直接邀请</div>
                <div className="text-sm">{stats.directTotal} 人（{stats.directValid} 有效）</div>
              </div>
              <div>
                <div className="text-xs text-gray-500">间接邀请</div>
                <div className="text-sm">{stats.indirectTotal} 人（{stats.indirectValid} 有效）</div>
              </div>
              <div>
                <div className="text-xs text-gray-500">总收益</div>
                <div className="text-sm font-bold">{stats.totalEarnings} 元</div>
              </div>
              <div>
                <div className="text-xs text-gray-500">已提现</div>
                <div className="text-sm">{stats.totalWithdrawn} 元</div>
              </div>
              <div>
                <div className="text-xs text-gray-500">待审核</div>
                <div className="text-sm text-amber-600">{stats.pendingWithdrawal} 元</div>
              </div>
              <div>
                <div className="text-xs text-gray-500">可提现余额</div>
                <div className="text-sm font-bold text-success-600">{stats.availableBalance} 元</div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 审核操作 */}
      {withdrawal.status === 'PENDING' && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">审核操作</h2>
          <div className="flex gap-4">
            <button
              onClick={handleApprove}
              disabled={isLoading}
              className="flex-1 bg-success-600 text-white py-3 px-6 rounded-lg hover:bg-success-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
            >
              ✓ 批准提现
            </button>
            <button
              onClick={() => setShowRejectModal(true)}
              disabled={isLoading}
              className="flex-1 bg-red-600 text-white py-3 px-6 rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
            >
              ✗ 驳回申请
            </button>
          </div>
        </div>
      )}

      {/* 驳回原因模态框 */}
      {showRejectModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-bold text-gray-900 mb-4">驳回提现申请</h3>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                驳回原因 <span className="text-red-500">*</span>
              </label>
              <textarea
                value={rejectNote}
                onChange={(e) => setRejectNote(e.target.value)}
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                placeholder="请输入驳回原因..."
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowRejectModal(false)
                  setRejectNote('')
                }}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                取消
              </button>
              <button
                onClick={handleReject}
                disabled={isLoading || !rejectNote.trim()}
                className="flex-1 bg-red-600 text-white py-2 px-4 rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                确认驳回
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
