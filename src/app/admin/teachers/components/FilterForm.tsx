'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

type FilterFormProps = {
  initialFilters: {
    search?: string
    taskIndex?: string
    startDate?: string
    endDate?: string
    referralStatus?: string
  }
}

export default function FilterForm({ initialFilters }: FilterFormProps) {
  const router = useRouter()
  const [searchTerm, setSearchTerm] = useState(initialFilters.search || '')
  const [taskIndex, setTaskIndex] = useState(initialFilters.taskIndex || '')
  const [startDate, setStartDate] = useState(initialFilters.startDate || '')
  const [endDate, setEndDate] = useState(initialFilters.endDate || '')
  const [referralStatus, setReferralStatus] = useState(initialFilters.referralStatus || '')

  // 应用筛选
  const handleApplyFilters = () => {
    const params = new URLSearchParams()
    if (searchTerm) params.set('search', searchTerm)
    if (taskIndex) params.set('taskIndex', taskIndex)
    if (startDate) params.set('startDate', startDate)
    if (endDate) params.set('endDate', endDate)
    if (referralStatus) params.set('referralStatus', referralStatus)
    
    router.push(`/admin/teachers?${params.toString()}`)
  }

  // 重置筛选
  const handleReset = () => {
    setSearchTerm('')
    setTaskIndex('')
    setStartDate('')
    setEndDate('')
    setReferralStatus('')
    router.push('/admin/teachers')
  }

  return (
    <div className="card mb-6">
      <div className="flex flex-col gap-4">
        {/* 第一行：搜索框、任务进度、邀请状态、重置按钮 */}
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <input
              type="text"
              placeholder="搜索姓名/ID/邀请码/手机号..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleApplyFilters()}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>
          <select
            value={taskIndex}
            onChange={(e) => setTaskIndex(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
          >
            <option value="">任务进度（全部）</option>
            <option value="0">任务 0/6</option>
            <option value="1">任务 1/6</option>
            <option value="2">任务 2/6</option>
            <option value="3">任务 3/6</option>
            <option value="4">任务 4/6</option>
            <option value="5">任务 5/6</option>
            <option value="6">任务 6/6（已完成）</option>
          </select>
          <select
            value={referralStatus}
            onChange={(e) => setReferralStatus(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
          >
            <option value="">邀请状态（全部）</option>
            <option value="hasReferrals">有邀请</option>
            <option value="noReferrals">无邀请</option>
            <option value="validReferrals">有有效邀请</option>
          </select>
          <button
            onClick={handleReset}
            className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors whitespace-nowrap"
          >
            重置
          </button>
        </div>

        {/* 第二行：日期区间、筛选按钮 */}
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 flex flex-col sm:flex-row items-start sm:items-center gap-2">
            <label className="text-sm text-gray-600 whitespace-nowrap">注册时间：</label>
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
  )
}
