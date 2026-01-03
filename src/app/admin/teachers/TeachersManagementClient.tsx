'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { getTeacherStatusText } from '@/lib/utils'

type Teacher = {
  id: string
  name: string | null
  school: string | null
  status: string
  currentTaskIndex: number
  createdAt: Date
}

export default function TeachersManagementClient({
  initialTeachers,
  initialFilters
}: {
  initialTeachers: Teacher[]
  initialFilters: {
    search?: string
    taskIndex?: string
    startDate?: string
    endDate?: string
  }
}) {
  const router = useRouter()
  const [searchTerm, setSearchTerm] = useState(initialFilters.search || '')
  const [taskIndex, setTaskIndex] = useState(initialFilters.taskIndex || '')
  const [startDate, setStartDate] = useState(initialFilters.startDate || '')
  const [endDate, setEndDate] = useState(initialFilters.endDate || '')

  // 应用筛选
  const handleApplyFilters = () => {
    const params = new URLSearchParams()
    if (searchTerm) params.set('search', searchTerm)
    if (taskIndex) params.set('taskIndex', taskIndex)
    if (startDate) params.set('startDate', startDate)
    if (endDate) params.set('endDate', endDate)
    
    router.push(`/admin/teachers?${params.toString()}`)
  }

  // 重置筛选
  const handleReset = () => {
    setSearchTerm('')
    setTaskIndex('')
    setStartDate('')
    setEndDate('')
    router.push('/admin/teachers')
  }

  return (
    <div>
      {/* 筛选区域 */}
      <div className="card mb-6">
        <div className="flex flex-col gap-4">
          {/* 第一行：搜索框、任务进度、重置按钮 */}
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <input
                type="text"
                placeholder="搜索姓名/ID/邀请码..."
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
            <button
              onClick={handleReset}
              className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            >
              重置
            </button>
          </div>

          {/* 第二行：日期区间、筛选按钮 */}
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 flex flex-col sm:flex-row items-start sm:items-center gap-2">
              <label className="text-sm text-gray-600 whitespace-nowrap">注册时间：</label>
              <div className="flex items-center gap-2 flex-1">
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
              className="px-8 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
            >
              筛选
            </button>
          </div>
        </div>
      </div>

      {/* 结果统计 */}
      <div className="mb-4">
        <p className="text-gray-600">
          共 {initialTeachers.length} 位老师
        </p>
      </div>

      {/* 老师列表 */}
      {initialTeachers.length === 0 ? (
        <div className="card text-center py-12">
          <div className="text-6xl mb-4">👥</div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            暂无符合条件的老师
          </h2>
          <p className="text-gray-600 mb-4">
            请尝试调整筛选条件
          </p>
          <button
            onClick={handleReset}
            className="btn-outline"
          >
            重置筛选
          </button>
        </div>
      ) : (
        <div className="card overflow-hidden p-0">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  ID
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  姓名
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  学校
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  状态
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  当前任务
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  注册时间
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  操作
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {initialTeachers.map(teacher => (
                <tr key={teacher.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-500">
                    {teacher.id.substring(0, 8)}...
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {teacher.name || <span className="text-gray-400">未填写</span>}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                    {teacher.school || <span className="text-gray-400">-</span>}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`badge ${
                      teacher.status === 'UNLOCKED' ? 'badge-success' :
                      teacher.status === 'COMPLETED' ? 'badge-primary' :
                      'badge-gray'
                    }`}>
                      {getTeacherStatusText(teacher.status)}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                    {teacher.currentTaskIndex} / 6
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(teacher.createdAt).toLocaleDateString('zh-CN')}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <Link
                      href={`/admin/teachers/${teacher.id}`}
                      className="text-primary-600 hover:text-primary-900 font-medium"
                    >
                      查看详情
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
