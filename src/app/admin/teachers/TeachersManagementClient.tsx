'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { TOTAL_TASK_COUNT } from '@/lib/config'
import { getTeacherStatusText, formatDateTime } from '@/lib/utils'
import { resetTeacherPassword } from '@/app/actions/teacher'

type Teacher = {
  id: string
  name: string | null
  phone: string
  school: string | null
  mathScore: number | null
  status: string
  currentTaskIndex: number
  updatedAt: Date
  teamAssignment: { id: string } | null
  invitedBy: { name: string | null } | null
}

export default function TeachersManagementClient({
  initialTeachers,
  initialFilters,
  pagination,
  adminRole
}: {
  initialTeachers: Teacher[]
  initialFilters: {
    search?: string
    taskIndex?: string
    startDate?: string
    endDate?: string
    teamStatus?: string
    teacherStatus?: string
    inviterSearch?: string
  }
  pagination?: {
    currentPage: number
    totalPages: number
    totalCount: number
    pageSize: number
    hasNextPage: boolean
    hasPrevPage: boolean
  }
  adminRole: string
}) {
  const router = useRouter()
  const [searchTerm, setSearchTerm] = useState(initialFilters.search || '')
  const [taskIndex, setTaskIndex] = useState(initialFilters.taskIndex || '')
  const [startDate, setStartDate] = useState(initialFilters.startDate || '')
  const [endDate, setEndDate] = useState(initialFilters.endDate || '')
  const [teamStatus, setTeamStatus] = useState(initialFilters.teamStatus || '')
  const [teacherStatus, setTeacherStatus] = useState(initialFilters.teacherStatus || '')
  const [inviterSearch, setInviterSearch] = useState(initialFilters.inviterSearch || '')
  const [resetModal, setResetModal] = useState<{ id: string; name: string | null } | null>(null)
  const [resetPassword, setResetPassword] = useState('123456')
  const [resetLoading, setResetLoading] = useState(false)
  const [resetMsg, setResetMsg] = useState('')

  const openResetModal = (teacherId: string, teacherName: string | null) => {
    setResetModal({ id: teacherId, name: teacherName })
    setResetPassword('123456')
    setResetMsg('')
  }

  const closeResetModal = () => {
    setResetModal(null)
    setResetPassword('123456')
    setResetMsg('')
  }

  const handleResetPassword = async () => {
    if (!resetModal) return
    if (resetPassword.length < 6) {
      setResetMsg('密码至少 6 位')
      return
    }
    setResetLoading(true)
    setResetMsg('')
    const result = await resetTeacherPassword(resetModal.id, resetPassword)
    setResetLoading(false)
    if (result.success) {
      setResetMsg(`✅ ${result.message || '密码重置成功'}`)
      setTimeout(() => {
        closeResetModal()
        router.refresh()
      }, 1200)
    } else {
      setResetMsg(`❌ ${result.error || '操作失败'}`)
    }
  }

  // 应用筛选
  const handleApplyFilters = () => {
    const params = new URLSearchParams()
    if (searchTerm) params.set('search', searchTerm)
    if (taskIndex) params.set('taskIndex', taskIndex)
    if (startDate) params.set('startDate', startDate)
    if (endDate) params.set('endDate', endDate)
    if (teamStatus) params.set('teamStatus', teamStatus)
    if (teacherStatus) params.set('teacherStatus', teacherStatus)
    if (inviterSearch) params.set('inviterSearch', inviterSearch)
    
    router.push(`/admin/teachers?${params.toString()}`)
  }

  // 重置筛选
  const handleReset = () => {
    setSearchTerm('')
    setTaskIndex('')
    setStartDate('')
    setEndDate('')
    setTeamStatus('')
    setTeacherStatus('')
    setInviterSearch('')
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
    if (teamStatus) params.set('teamStatus', teamStatus)
    if (teacherStatus) params.set('teacherStatus', teacherStatus)
    if (inviterSearch) params.set('inviterSearch', inviterSearch)
    
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
              <option value="0">任务 0/7</option>
              <option value="1">任务 1/7</option>
              <option value="2">任务 2/7</option>
              <option value="3">任务 3/7</option>
              <option value="4">任务 4/7</option>
              <option value="5">任务 5/7</option>
              <option value="6">任务 6/7</option>
              <option value="7">任务 7/7（已完成）</option>
            </select>
            <select
              value={teacherStatus}
              onChange={(e) => setTeacherStatus(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
            >
              <option value="">任务状态（全部）</option>
              <option value="in_progress">引导中</option>
              <option value="completed">已完成</option>
            </select>
            <select
              value={teamStatus}
              onChange={(e) => setTeamStatus(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
            >
              <option value="">团队状态（全部）</option>
              <option value="claimed">已认领</option>
              <option value="unclaimed">暂未被认领</option>
            </select>
            <button
              onClick={handleReset}
              className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            >
              重置
            </button>
          </div>

          {/* 第二行：邀请人搜索、日期区间、筛选按钮 */}
          <div className="flex flex-col md:flex-row gap-4">
            <input
              type="text"
              placeholder="邀请人姓名/手机号/ID..."
              value={inviterSearch}
              onChange={(e) => setInviterSearch(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleApplyFilters()}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
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
                  姓名 / 学校 / 分数
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  状态 / 任务
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  邀请人
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  团队状态
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
                  <td className="px-6 py-4 text-sm">
                    <div className="font-medium text-gray-900">
                      {teacher.name || <span className="text-gray-400">未填写</span>}
                    </div>
                    <div className="text-gray-500 text-xs mt-0.5" title={teacher.school || undefined}>
                      {teacher.school
                        ? (Array.from(teacher.school).length > 10
                            ? `${Array.from(teacher.school).slice(0, 10).join('')}...`
                            : teacher.school)
                        : <span className="text-gray-400">-</span>}
                    </div>
                    <div className="text-gray-500 text-xs mt-0.5">
                      {teacher.mathScore !== null ? `${teacher.mathScore}分` : <span className="text-gray-400">-</span>}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm">
                    <span className={`badge ${
                      teacher.status === 'UNLOCKED' ? 'badge-success' :
                      teacher.status === 'COMPLETED' ? 'badge-primary' :
                      'badge-gray'
                    }`}>
                      {getTeacherStatusText(teacher.status)}
                    </span>
                    <div className="text-gray-500 text-xs mt-1">
                      {teacher.currentTaskIndex} / {TOTAL_TASK_COUNT}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                    {teacher.invitedBy
                      ? (teacher.invitedBy.name || <span className="text-gray-400">未填写</span>)
                      : <span className="text-gray-400">-</span>
                    }
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`badge ${
                      teacher.teamAssignment ? 'badge-success' : 'badge-gray'
                    }`}>
                      {teacher.teamAssignment ? '已认领' : '暂未被认领'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {formatDateTime(teacher.updatedAt)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <div className="flex items-center gap-3">
                      <Link
                        href={`/admin/teachers/${teacher.id}`}
                        className="text-primary-600 hover:text-primary-900 font-medium transition-colors"
                      >
                        查看详情
                      </Link>
                      {adminRole === 'super_admin' && (
                        <button
                          onClick={() => openResetModal(teacher.id, teacher.name)}
                          className="text-red-600 hover:text-red-900 font-medium transition-colors"
                        >
                          重置密码
                        </button>
                      )}
                    </div>
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

      {/* 重置密码弹窗 */}
      {resetModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm">
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <h3 className="text-base font-bold text-gray-900">重置密码</h3>
              <button onClick={closeResetModal} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            <div className="p-5 space-y-4">
              <p className="text-sm text-gray-600">
                为 <span className="font-medium text-gray-900">「{resetModal.name || '该老师'}」</span> 设置新密码：
              </p>
              <input
                type="text"
                value={resetPassword}
                onChange={(e) => { setResetPassword(e.target.value); setResetMsg('') }}
                className="input w-full font-mono"
                placeholder="请输入新密码（至少 6 位）"
                autoFocus
              />
              {resetMsg && (
                <p className={`text-sm ${resetMsg.startsWith('✅') ? 'text-green-600' : 'text-red-500'}`}>
                  {resetMsg}
                </p>
              )}
              <div className="flex gap-3 pt-1">
                <button
                  onClick={closeResetModal}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium"
                >
                  取消
                </button>
                <button
                  onClick={handleResetPassword}
                  disabled={resetLoading}
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm font-medium disabled:opacity-50"
                >
                  {resetLoading ? '重置中...' : '确认重置'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
