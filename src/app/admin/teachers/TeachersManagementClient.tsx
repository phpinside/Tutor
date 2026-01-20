'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { getTeacherStatusText, formatDateTime } from '@/lib/utils'

type Teacher = {
  id: string
  name: string | null
  school: string | null
  status: string
  currentTaskIndex: number
  teachingStatus: string
  updatedAt: Date
}

export default function TeachersManagementClient({
  initialTeachers,
  initialFilters,
  pagination
}: {
  initialTeachers: Teacher[]
  initialFilters: {
    search?: string
    taskIndex?: string
    startDate?: string
    endDate?: string
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
  const [searchTerm, setSearchTerm] = useState(initialFilters.search || '')
  const [taskIndex, setTaskIndex] = useState(initialFilters.taskIndex || '')
  const [startDate, setStartDate] = useState(initialFilters.startDate || '')
  const [endDate, setEndDate] = useState(initialFilters.endDate || '')
  const [teachingStatus, setTeachingStatus] = useState(initialFilters.teachingStatus || '')

  // 应用筛选
  const handleApplyFilters = () => {
    const params = new URLSearchParams()
    if (searchTerm) params.set('search', searchTerm)
    if (taskIndex) params.set('taskIndex', taskIndex)
    if (startDate) params.set('startDate', startDate)
    if (endDate) params.set('endDate', endDate)
    if (teachingStatus) params.set('teachingStatus', teachingStatus)
    
    router.push(`/admin/teachers?${params.toString()}`)
  }

  // 重置筛选
  const handleReset = () => {
    setSearchTerm('')
    setTaskIndex('')
    setStartDate('')
    setEndDate('')
    setTeachingStatus('')
    router.push('/admin/teachers')
  }
  
  // 翻页
  const goToPage = (page: number) => {
    const params = new URLSearchParams()
    params.set('page', page.toString())
    if (searchTerm) params.set('search', searchTerm)
    if (taskIndex) params.set('taskIndex', taskIndex)
    if (startDate) params.set('startDate', startDate)
    if (endDate) params.set('endDate', endDate)
    if (teachingStatus) params.set('teachingStatus', teachingStatus)
    
    router.push(`/admin/teachers?${params.toString()}`)
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
            <select
              value={teachingStatus}
              onChange={(e) => setTeachingStatus(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
            >
              <option value="">授课状态（全部）</option>
              <option value="not_taught">未授课</option>
              <option value="taught">已授课</option>
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
                  授课状态
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  更新时间
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  操作
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {initialTeachers.map(teacher => (
                <tr key={teacher.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-mono">
                    <Link
                      href={`/admin/teachers/${teacher.id}`}
                      className="text-primary-600 hover:text-primary-900 hover:underline"
                    >
                      {teacher.id.substring(0, 8)}...
                    </Link>
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
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`badge ${
                      teacher.teachingStatus === 'TAUGHT' ? 'badge-success' : 'badge-gray'
                    }`}>
                      {teacher.teachingStatus === 'TAUGHT' ? '已授课' : '未授课'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {formatDateTime(teacher.updatedAt)}
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
