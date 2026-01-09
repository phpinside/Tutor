'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { formatDateTime } from '@/lib/utils'

type Withdrawal = {
  id: string
  amount: number
  accountName: string
  bankName: string
  cardNumber: string
  phone: string
  status: 'PENDING' | 'APPROVED' | 'REJECTED'
  rejectNote: string | null
  createdAt: Date
  teacher: {
    id: string
    name: string | null
    phone: string | null
  }
}

export default function WithdrawalManagementClient({
  initialWithdrawals,
  initialFilters
}: {
  initialWithdrawals: Withdrawal[]
  initialFilters?: {
    status?: string
    startDate?: string
    endDate?: string
    search?: string
  }
}) {
  const router = useRouter()
  const [statusFilter, setStatusFilter] = useState(initialFilters?.status || '')
  const [startDate, setStartDate] = useState(initialFilters?.startDate || '')
  const [endDate, setEndDate] = useState(initialFilters?.endDate || '')
  const [searchTerm, setSearchTerm] = useState(initialFilters?.search || '')

  const handleApplyFilters = () => {
    const params = new URLSearchParams()
    if (statusFilter) params.set('status', statusFilter)
    if (startDate) params.set('startDate', startDate)
    if (endDate) params.set('endDate', endDate)
    if (searchTerm) params.set('search', searchTerm)
    
    router.push(`/admin/withdrawals?${params.toString()}`)
  }

  const handleReset = () => {
    setStatusFilter('')
    setStartDate('')
    setEndDate('')
    setSearchTerm('')
    router.push('/admin/withdrawals')
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PENDING':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">待审核</span>
      case 'APPROVED':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-success-100 text-success-800">已批准</span>
      case 'REJECTED':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">已驳回</span>
      default:
        return null
    }
  }

  return (
    <div className="bg-white rounded-lg shadow">
      {/* 筛选器 */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex flex-col md:flex-row gap-4">
          <input
            type="text"
            placeholder="搜索提现人姓名或手机号..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleApplyFilters()}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
          />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
          >
            <option value="">全部状态</option>
            <option value="PENDING">待审核</option>
            <option value="APPROVED">已批准</option>
            <option value="REJECTED">已驳回</option>
          </select>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
          />
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
          />
          <button
            onClick={handleApplyFilters}
            className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
          >
            筛选
          </button>
          <button
            onClick={handleReset}
            className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            重置
          </button>
        </div>
      </div>

      {/* 提现列表 */}
      <div className="overflow-x-auto">
        {initialWithdrawals.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            暂无提现申请
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">提现人</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">提现金额</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">账户信息</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">状态</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">申请时间</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">操作</th>
              </tr>
            </thead>
            <tbody>
              {initialWithdrawals.map((withdrawal) => (
                <tr key={withdrawal.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="py-3 px-4 text-sm">
                    <div className="font-medium">{withdrawal.teacher.name || '未填写'}</div>
                    <div className="text-xs text-gray-500">{withdrawal.teacher.phone || '-'}</div>
                  </td>
                  <td className="py-3 px-4 text-sm">
                    <span className="font-bold text-amber-600">{withdrawal.amount} 元</span>
                  </td>
                  <td className="py-3 px-4 text-sm">
                    <div>{withdrawal.accountName}</div>
                    <div className="text-xs text-gray-500">{withdrawal.bankName}</div>
                    <div className="text-xs text-gray-500">{withdrawal.cardNumber}</div>
                  </td>
                  <td className="py-3 px-4 text-sm">
                    {getStatusBadge(withdrawal.status)}
                    {withdrawal.status === 'REJECTED' && withdrawal.rejectNote && (
                      <div className="text-xs text-red-600 mt-1">{withdrawal.rejectNote}</div>
                    )}
                  </td>
                  <td className="py-3 px-4 text-sm text-gray-600">
                    {formatDateTime(withdrawal.createdAt)}
                  </td>
                  <td className="py-3 px-4 text-sm">
                    <Link
                      href={`/admin/withdrawals/${withdrawal.id}`}
                      className="text-primary-600 hover:text-primary-700 font-medium"
                    >
                      查看详情
                    </Link>
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
