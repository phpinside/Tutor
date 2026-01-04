'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { approveWithdrawal, rejectWithdrawal } from '@/app/actions/withdrawal'
import Link from 'next/link'

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
}

type Teacher = {
  id: string
  name: string | null
  phone: string | null
  createdAt: Date
}

type ReferralStats = {
  total: number
  valid: number
  invalid: number
  pending: number
}

type WithdrawalStats = {
  totalApplied: number
  totalApproved: number
  totalRejected: number
  totalAmount: number
}

type WithdrawalHistory = {
  id: string
  amount: number
  status: string
  createdAt: Date
  reviewedAt: Date | null
}

export default function WithdrawalDetailClient({
  withdrawal,
  teacher,
  referralStats,
  withdrawalStats,
  withdrawalHistory
}: {
  withdrawal: Withdrawal
  teacher: Teacher
  referralStats: ReferralStats
  withdrawalStats: WithdrawalStats
  withdrawalHistory: WithdrawalHistory[]
}) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [showRejectModal, setShowRejectModal] = useState(false)
  const [rejectNote, setRejectNote] = useState('')
  
  const handleApprove = async () => {
    if (!confirm('确认批准此提现申请？')) return
    
    setLoading(true)
    const result = await approveWithdrawal(withdrawal.id, 'admin')
    setLoading(false)
    
    if (result.success) {
      router.refresh()
      router.push('/admin/withdrawals')
    } else {
      alert(result.error || '操作失败')
    }
  }
  
  const handleReject = async () => {
    if (!rejectNote.trim()) {
      alert('请填写驳回原因')
      return
    }
    
    setLoading(true)
    const result = await rejectWithdrawal(withdrawal.id, 'admin', rejectNote)
    setLoading(false)
    
    if (result.success) {
      setShowRejectModal(false)
      router.refresh()
      router.push('/admin/withdrawals')
    } else {
      alert(result.error || '操作失败')
    }
  }
  
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PENDING':
        return <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-amber-100 text-amber-800">⏳ 已申请</span>
      case 'APPROVED':
        return <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-success-100 text-success-800">✅ 已成功</span>
      case 'REJECTED':
        return <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-red-100 text-red-800">❌ 已驳回</span>
      default:
        return null
    }
  }
  
  return (
    <div className="p-6">
      {/* 顶部导航 */}
      <div className="mb-6">
        <Link
          href="/admin/withdrawals"
          className="text-primary-600 hover:text-primary-700 font-medium inline-flex items-center"
        >
          ← 返回提现管理
        </Link>
      </div>
      
      {/* 页面标题 */}
      <div className="mb-6 flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">提现申请详情</h1>
          <p className="text-gray-600 mt-1">申请时间：{new Date(withdrawal.createdAt).toLocaleString('zh-CN')}</p>
        </div>
        <div>
          {getStatusBadge(withdrawal.status)}
        </div>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 左侧：提现信息 */}
        <div className="lg:col-span-2 space-y-6">
          {/* 提现信息卡片 */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">💰 提现信息</h2>
            <div className="space-y-4">
              <div className="flex justify-between py-3 border-b border-gray-100">
                <span className="text-gray-600">提现金额</span>
                <span className="font-bold text-xl text-amber-600">¥{withdrawal.amount}</span>
              </div>
              <div className="flex justify-between py-3 border-b border-gray-100">
                <span className="text-gray-600">账户名称</span>
                <span className="font-medium">{withdrawal.accountName}</span>
              </div>
              <div className="flex justify-between py-3 border-b border-gray-100">
                <span className="text-gray-600">开户行</span>
                <span className="font-medium">{withdrawal.bankName}</span>
              </div>
              <div className="flex justify-between py-3 border-b border-gray-100">
                <span className="text-gray-600">银行卡号</span>
                <span className="font-mono text-sm">{withdrawal.cardNumber.replace(/(\d{4})/g, '$1 ').trim()}</span>
              </div>
              <div className="flex justify-between py-3 border-b border-gray-100">
                <span className="text-gray-600">手机号</span>
                <span className="font-medium">{withdrawal.phone}</span>
              </div>
              <div className="flex justify-between py-3 border-b border-gray-100">
                <span className="text-gray-600">身份证号</span>
                <span className="font-mono text-sm">{withdrawal.idCard}</span>
              </div>
              {withdrawal.status === 'REJECTED' && withdrawal.rejectNote && (
                <div className="py-3 border-b border-gray-100">
                  <div className="text-gray-600 mb-2">驳回原因</div>
                  <div className="bg-red-50 border border-red-200 rounded p-3 text-red-800 text-sm">
                    {withdrawal.rejectNote}
                  </div>
                </div>
              )}
              {withdrawal.reviewedAt && (
                <div className="flex justify-between py-3">
                  <span className="text-gray-600">审核时间</span>
                  <span className="text-sm">{new Date(withdrawal.reviewedAt).toLocaleString('zh-CN')}</span>
                </div>
              )}
            </div>
          </div>
          
          {/* 操作按钮 */}
          {withdrawal.status === 'PENDING' && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">审核操作</h2>
              <div className="flex gap-4">
                <button
                  onClick={handleApprove}
                  disabled={loading}
                  className="flex-1 bg-success-600 text-white py-3 px-6 rounded-lg hover:bg-success-700 transition-colors font-medium disabled:opacity-50"
                >
                  {loading ? '处理中...' : '✅ 批准提现'}
                </button>
                <button
                  onClick={() => setShowRejectModal(true)}
                  disabled={loading}
                  className="flex-1 bg-red-600 text-white py-3 px-6 rounded-lg hover:bg-red-700 transition-colors font-medium disabled:opacity-50"
                >
                  ❌ 驳回申请
                </button>
              </div>
            </div>
          )}
          
          {/* 提现历史 */}
          {withdrawalHistory.length > 0 && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">📋 提现历史</h2>
              <div className="space-y-3">
                {withdrawalHistory.map((item) => (
                  <div
                    key={item.id}
                    className={`flex justify-between items-center p-3 rounded-lg border ${
                      item.id === withdrawal.id ? 'bg-primary-50 border-primary-200' : 'bg-gray-50 border-gray-200'
                    }`}
                  >
                    <div>
                      <div className="font-medium">¥{item.amount}</div>
                      <div className="text-xs text-gray-500">
                        {new Date(item.createdAt).toLocaleDateString('zh-CN')}
                      </div>
                    </div>
                    <div>
                      {item.status === 'PENDING' && (
                        <span className="text-xs px-2 py-1 rounded-full bg-amber-100 text-amber-800">已申请</span>
                      )}
                      {item.status === 'APPROVED' && (
                        <span className="text-xs px-2 py-1 rounded-full bg-success-100 text-success-800">已成功</span>
                      )}
                      {item.status === 'REJECTED' && (
                        <span className="text-xs px-2 py-1 rounded-full bg-red-100 text-red-800">已驳回</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        
        {/* 右侧：申请人信息 */}
        <div className="space-y-6">
          {/* 申请人信息 */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">👤 申请人信息</h2>
            <div className="space-y-3">
              <div>
                <div className="text-sm text-gray-600">姓名</div>
                <div className="font-medium">{teacher.name || '未填写'}</div>
              </div>
              <div>
                <div className="text-sm text-gray-600">手机号</div>
                <div className="font-medium">{teacher.phone || '未填写'}</div>
              </div>
              <div>
                <div className="text-sm text-gray-600">注册时间</div>
                <div className="text-sm">{new Date(teacher.createdAt).toLocaleDateString('zh-CN')}</div>
              </div>
              <div className="pt-3 border-t border-gray-200">
                <Link
                  href={`/admin/teachers/${teacher.id}`}
                  className="text-primary-600 hover:text-primary-700 text-sm font-medium"
                >
                  查看详细信息 →
                </Link>
              </div>
            </div>
          </div>
          
          {/* 邀请统计 */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">📊 邀请统计</h2>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-600">总邀请数</span>
                <span className="font-bold text-primary-600">{referralStats.total}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">有效邀请</span>
                <span className="font-bold text-success-600">{referralStats.valid}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">待审核</span>
                <span className="font-bold text-amber-600">{referralStats.pending}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">无效邀请</span>
                <span className="font-bold text-red-600">{referralStats.invalid}</span>
              </div>
            </div>
          </div>
          
          {/* 提现统计 */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">💳 提现统计</h2>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-600">申请次数</span>
                <span className="font-bold">{withdrawalStats.totalApplied}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">成功次数</span>
                <span className="font-bold text-success-600">{withdrawalStats.totalApproved}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">驳回次数</span>
                <span className="font-bold text-red-600">{withdrawalStats.totalRejected}</span>
              </div>
              <div className="flex justify-between pt-3 border-t border-gray-200">
                <span className="text-gray-600">已提现总额</span>
                <span className="font-bold text-xl text-amber-600">¥{withdrawalStats.totalAmount}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* 驳回模态框 */}
      {showRejectModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">驳回提现申请</h3>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                驳回原因<span className="text-red-500">*</span>
              </label>
              <textarea
                value={rejectNote}
                onChange={(e) => setRejectNote(e.target.value)}
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                placeholder="请输入驳回原因..."
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={handleReject}
                disabled={loading}
                className="flex-1 bg-red-600 text-white py-2 px-4 rounded-lg hover:bg-red-700 transition-colors font-medium disabled:opacity-50"
              >
                {loading ? '处理中...' : '确认驳回'}
              </button>
              <button
                onClick={() => setShowRejectModal(false)}
                disabled={loading}
                className="flex-1 bg-gray-100 text-gray-700 py-2 px-4 rounded-lg hover:bg-gray-200 transition-colors font-medium disabled:opacity-50"
              >
                取消
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
