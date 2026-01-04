'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { approveWithdrawal, rejectWithdrawal } from '@/app/actions/withdrawal'
import Link from 'next/link'

type Withdrawal = {
  id: string
  teacherId: string
  teacherName: string | null
  teacherPhone: string | null
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

type Stats = {
  total: number
  pending: number
  approved: number
  rejected: number
  totalAmount: number
}

export default function WithdrawalManagementClient({
  withdrawals,
  stats,
  filters
}: {
  withdrawals: Withdrawal[]
  stats: Stats
  filters: {
    status?: string
    startDate?: string
    endDate?: string
    search?: string
  }
}) {
  const router = useRouter()
  const [filterForm, setFilterForm] = useState({
    status: filters.status || 'all',
    startDate: filters.startDate || '',
    endDate: filters.endDate || '',
    search: filters.search || ''
  })
  
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [rejectModal, setRejectModal] = useState<{
    show: boolean
    withdrawalId: string | null
    note: string
  }>({
    show: false,
    withdrawalId: null,
    note: ''
  })
  
  // 应用筛选
  const applyFilters = () => {
    const params = new URLSearchParams()
    if (filterForm.status !== 'all') params.set('status', filterForm.status)
    if (filterForm.startDate) params.set('startDate', filterForm.startDate)
    if (filterForm.endDate) params.set('endDate', filterForm.endDate)
    if (filterForm.search) params.set('search', filterForm.search)
    
    router.push(`/admin/withdrawals?${params.toString()}`)
  }
  
  // 清除筛选
  const clearFilters = () => {
    setFilterForm({
      status: 'all',
      startDate: '',
      endDate: '',
      search: ''
    })
    router.push('/admin/withdrawals')
  }
  
  // 批准提现
  const handleApprove = async (withdrawalId: string) => {
    if (!confirm('确认批准此提现申请？')) return
    
    setActionLoading(withdrawalId)
    const result = await approveWithdrawal(withdrawalId, 'admin')
    setActionLoading(null)
    
    if (result.success) {
      router.refresh()
    } else {
      alert(result.error || '操作失败')
    }
  }
  
  // 打开驳回模态框
  const openRejectModal = (withdrawalId: string) => {
    setRejectModal({
      show: true,
      withdrawalId,
      note: ''
    })
  }
  
  // 确认驳回
  const handleReject = async () => {
    if (!rejectModal.withdrawalId) return
    if (!rejectModal.note.trim()) {
      alert('请填写驳回原因')
      return
    }
    
    setActionLoading(rejectModal.withdrawalId)
    const result = await rejectWithdrawal(
      rejectModal.withdrawalId,
      'admin',
      rejectModal.note
    )
    setActionLoading(null)
    
    if (result.success) {
      setRejectModal({ show: false, withdrawalId: null, note: '' })
      router.refresh()
    } else {
      alert(result.error || '操作失败')
    }
  }
  
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PENDING':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">⏳ 已申请</span>
      case 'APPROVED':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-success-100 text-success-800">✅ 已成功</span>
      case 'REJECTED':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">❌ 已驳回</span>
      default:
        return null
    }
  }
  
  return (
    <div className="p-6">
      {/* 页面标题 */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">提现管理</h1>
        <p className="text-gray-600 mt-1">管理和审核提现申请</p>
      </div>
      
      {/* 统计卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow-sm p-4 border border-gray-200">
          <div className="text-2xl font-bold text-gray-900">{stats.total}</div>
          <div className="text-sm text-gray-600 mt-1">总申请数</div>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-4 border border-amber-200">
          <div className="text-2xl font-bold text-amber-600">{stats.pending}</div>
          <div className="text-sm text-gray-600 mt-1">待处理</div>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-4 border border-success-200">
          <div className="text-2xl font-bold text-success-600">{stats.approved}</div>
          <div className="text-sm text-gray-600 mt-1">已批准</div>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-4 border border-red-200">
          <div className="text-2xl font-bold text-red-600">{stats.rejected}</div>
          <div className="text-sm text-gray-600 mt-1">已驳回</div>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-4 border border-primary-200">
          <div className="text-2xl font-bold text-primary-600">¥{stats.totalAmount}</div>
          <div className="text-sm text-gray-600 mt-1">已提现总额</div>
        </div>
      </div>
      
      {/* 筛选表单 */}
      <div className="bg-white rounded-lg shadow-sm p-4 mb-6 border border-gray-200">
        <h3 className="font-semibold text-gray-900 mb-4">筛选条件</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* 状态筛选 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              提现状态
            </label>
            <select
              value={filterForm.status}
              onChange={(e) => setFilterForm(prev => ({ ...prev, status: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm"
            >
              <option value="all">全部</option>
              <option value="PENDING">已申请</option>
              <option value="APPROVED">已成功</option>
              <option value="REJECTED">已驳回</option>
            </select>
          </div>
          
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
          
          {/* 搜索 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              搜索
            </label>
            <input
              type="text"
              value={filterForm.search}
              onChange={(e) => setFilterForm(prev => ({ ...prev, search: e.target.value }))}
              placeholder="姓名/手机号/卡号"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm"
            />
          </div>
        </div>
        
        {/* 筛选按钮 */}
        <div className="mt-4 flex gap-3">
          <button
            onClick={applyFilters}
            className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors text-sm font-medium"
          >
            应用筛选
          </button>
          <button
            onClick={clearFilters}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm font-medium"
          >
            清除筛选
          </button>
        </div>
      </div>
      
      {/* 提现申请列表 */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        {withdrawals.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">📋</div>
            <p className="text-gray-600">暂无提现申请</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">提现时间</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">申请人</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">提现金额</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">账户名称</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">开户行</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">卡号</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">状态</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">操作</th>
                </tr>
              </thead>
              <tbody>
                {withdrawals.map((withdrawal) => (
                  <tr key={withdrawal.id} className="border-t border-gray-100 hover:bg-gray-50">
                    <td className="py-3 px-4 text-sm">
                      {new Date(withdrawal.createdAt).toLocaleString('zh-CN')}
                    </td>
                    <td className="py-3 px-4 text-sm">
                      <div className="font-medium">{withdrawal.teacherName || '未知'}</div>
                      <div className="text-xs text-gray-500">{withdrawal.teacherPhone}</div>
                    </td>
                    <td className="py-3 px-4 text-sm font-medium text-amber-600">
                      ¥{withdrawal.amount}
                    </td>
                    <td className="py-3 px-4 text-sm">{withdrawal.accountName}</td>
                    <td className="py-3 px-4 text-sm">{withdrawal.bankName}</td>
                    <td className="py-3 px-4 text-sm font-mono text-xs">
                      {withdrawal.cardNumber.replace(/(\d{4})/g, '$1 ').trim()}
                    </td>
                    <td className="py-3 px-4 text-sm">{getStatusBadge(withdrawal.status)}</td>
                    <td className="py-3 px-4 text-sm">
                      <div className="flex gap-2">
                        <Link
                          href={`/admin/withdrawals/${withdrawal.id}`}
                          className="text-primary-600 hover:text-primary-700 font-medium"
                        >
                          查看
                        </Link>
                        {withdrawal.status === 'PENDING' && (
                          <>
                            <button
                              onClick={() => handleApprove(withdrawal.id)}
                              disabled={actionLoading === withdrawal.id}
                              className="text-success-600 hover:text-success-700 font-medium disabled:opacity-50"
                            >
                              {actionLoading === withdrawal.id ? '处理中...' : '批准'}
                            </button>
                            <button
                              onClick={() => openRejectModal(withdrawal.id)}
                              disabled={actionLoading === withdrawal.id}
                              className="text-red-600 hover:text-red-700 font-medium disabled:opacity-50"
                            >
                              驳回
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      
      {/* 驳回模态框 */}
      {rejectModal.show && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">驳回提现申请</h3>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                驳回原因<span className="text-red-500">*</span>
              </label>
              <textarea
                value={rejectModal.note}
                onChange={(e) => setRejectModal(prev => ({ ...prev, note: e.target.value }))}
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                placeholder="请输入驳回原因..."
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={handleReject}
                disabled={actionLoading !== null}
                className="flex-1 bg-red-600 text-white py-2 px-4 rounded-lg hover:bg-red-700 transition-colors font-medium disabled:opacity-50"
              >
                {actionLoading ? '处理中...' : '确认驳回'}
              </button>
              <button
                onClick={() => setRejectModal({ show: false, withdrawalId: null, note: '' })}
                disabled={actionLoading !== null}
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
