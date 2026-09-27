'use client'

import { useState, useTransition, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { getTeacherStatusText, formatDateTime, formatPhone } from '@/lib/utils'
import { usePersistedFilters, clearPersistedFilters } from '@/lib/hooks/usePersistedFilters'
import {
  addTeacherToTeam,
  removeTeacherFromTeam,
  searchAllTeachers,
} from '@/app/actions/operatorActions'

type TeamTeacher = {
  id: string
  name: string | null
  phone: string
  school: string | null
  status: string
  currentTaskIndex: number
  createdAt: Date
}

type SearchResult = {
  id: string
  name: string | null
  phone: string
  school: string | null
  status: string
  currentTaskIndex: number
  teamAssignment: { operatorId: string; operator: { name: string } } | null
}

const MAX_SCHOOL_DISPLAY_LENGTH = 10

// 与新手引导表单口径一致
const GAOKAO_PROVINCE_OPTIONS = [
  '北京', '天津', '河北', '山西', '内蒙古', '辽宁', '吉林', '黑龙江',
  '上海', '江苏', '浙江', '安徽', '福建', '江西', '山东',
  '河南', '湖北', '湖南', '广东', '广西', '海南',
  '重庆', '四川', '贵州', '云南', '西藏', '陕西', '甘肃', '青海', '宁夏', '新疆',
  '香港', '澳门', '台湾', '其它',
]

const SUBJECT_OPTIONS = [
  { value: 'MATH', label: '数学' },
  { value: 'PHYSICS', label: '物理' },
  { value: 'CHEMISTRY', label: '化学' },
]

const STATUS_OPTIONS = [
  { value: 'IN_PROGRESS', label: '进行中' },
  { value: 'COMPLETED', label: '已完成' },
  { value: 'UNLOCKED', label: '已解锁' },
]

export default function TeamManagementClient({
  operatorId,
  initialTeachers,
  initialFilters,
}: {
  operatorId: string
  initialTeachers: TeamTeacher[]
  initialFilters: {
    search?: string
    taskIndex?: string
    startDate?: string
    endDate?: string
    school?: string
    gender?: string
    gaokaoProvince?: string
    subject?: string
    scoreMin?: string
    status?: string
    inviterSearch?: string
  }
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  // 筛选状态
  const [searchTerm, setSearchTerm] = useState(initialFilters.search || '')
  const [taskIndex, setTaskIndex] = useState(initialFilters.taskIndex || '')
  const [startDate, setStartDate] = useState(initialFilters.startDate || '')
  const [endDate, setEndDate] = useState(initialFilters.endDate || '')
  const [school, setSchool] = useState(initialFilters.school || '')
  const [gender, setGender] = useState(initialFilters.gender || '')
  const [gaokaoProvince, setGaokaoProvince] = useState(initialFilters.gaokaoProvince || '')
  const [subject, setSubject] = useState(initialFilters.subject || '')
  const [scoreMin, setScoreMin] = useState(initialFilters.scoreMin || '')
  const [status, setStatus] = useState(initialFilters.status || '')
  const [inviterSearch, setInviterSearch] = useState(initialFilters.inviterSearch || '')

  // 添加老师弹窗
  const [showAddModal, setShowAddModal] = useState(false)
  const [addKeyword, setAddKeyword] = useState('')
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [searching, setSearching] = useState(false)
  const [addMessage, setAddMessage] = useState('')

  // 筛选项持久化：回退/跳转返回时保持（URL 优先，sessionStorage 兜底未应用项）
  usePersistedFilters(
    'team-filters',
    {
      search: searchTerm,
      taskIndex,
      startDate,
      endDate,
      school,
      gender,
      gaokaoProvince,
      subject,
      scoreMin,
      status,
      inviterSearch,
    },
    {
      search: setSearchTerm,
      taskIndex: setTaskIndex,
      startDate: setStartDate,
      endDate: setEndDate,
      school: setSchool,
      gender: setGender,
      gaokaoProvince: setGaokaoProvince,
      subject: setSubject,
      scoreMin: setScoreMin,
      status: setStatus,
      inviterSearch: setInviterSearch,
    }
  )

  const handleApplyFilters = () => {
    const params = new URLSearchParams()
    if (searchTerm) params.set('search', searchTerm)
    if (taskIndex) params.set('taskIndex', taskIndex)
    if (startDate) params.set('startDate', startDate)
    if (endDate) params.set('endDate', endDate)
    if (school) params.set('school', school)
    if (gender) params.set('gender', gender)
    if (gaokaoProvince) params.set('gaokaoProvince', gaokaoProvince)
    if (subject) params.set('subject', subject)
    if (scoreMin) params.set('scoreMin', scoreMin)
    if (status) params.set('status', status)
    if (inviterSearch) params.set('inviterSearch', inviterSearch)
    router.push(`/operator/team?${params.toString()}`)
  }

  const handleReset = () => {
    setSearchTerm('')
    setTaskIndex('')
    setStartDate('')
    setEndDate('')
    setSchool('')
    setGender('')
    setGaokaoProvince('')
    setSubject('')
    setScoreMin('')
    setStatus('')
    setInviterSearch('')
    clearPersistedFilters('team-filters')
    router.push('/operator/team')
  }

  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current)

    if (!addKeyword.trim()) {
      setSearchResults([])
      setSearching(false)
      return
    }

    setSearching(true)
    searchTimerRef.current = setTimeout(async () => {
      const results = await searchAllTeachers(addKeyword)
      setSearchResults(results)
      setSearching(false)
    }, 400)

    return () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current)
    }
  }, [addKeyword])

  const handleAdd = async (teacherId: string) => {
    setAddMessage('')
    const result = await addTeacherToTeam(operatorId, teacherId)
    if (result.success) {
      setAddMessage('✅ 添加成功')
      setSearchResults((prev) =>
        prev.map((t) =>
          t.id === teacherId
            ? { ...t, teamAssignment: { operatorId, operator: { name: '当前运营' } } }
            : t
        )
      )
      startTransition(() => router.refresh())
    } else {
      setAddMessage(`❌ ${result.error}`)
    }
  }

  const handleRemove = async (teacherId: string, teacherName: string | null) => {
    if (!confirm(`确定将「${teacherName || '该老师'}」移出你的团队？\n移出后该老师将脱离你的可见范围（除非仍是你邀请的或分配给你初审的）。`)) return
    await removeTeacherFromTeam(operatorId, teacherId)
    startTransition(() => router.refresh())
  }

  const getSchoolDisplayName = (school: string | null) => {
    if (!school) return '—'

    const schoolChars = Array.from(school)
    if (schoolChars.length <= MAX_SCHOOL_DISPLAY_LENGTH) return school

    return `${schoolChars.slice(0, MAX_SCHOOL_DISPLAY_LENGTH).join('')}...`
  }

  return (
    <div>
      {/* 筛选区域 */}
      <div className="card mb-6">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <input
                type="text"
                placeholder="搜索姓名 / 手机号 / ID..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleApplyFilters()}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <select
              value={taskIndex}
              onChange={(e) => setTaskIndex(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
            >
              <option value="">任务进度（全部）</option>
              {Array.from({ length: 8 }, (_, i) => (
                <option key={i} value={String(i)}>
                  任务 {i}/7 {i === 7 ? '（已完成）' : ''}
                </option>
              ))}
            </select>
            <button
              onClick={handleReset}
              className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            >
              重置
            </button>
          </div>

          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 flex items-center gap-2">
              <label className="text-sm text-gray-600 whitespace-nowrap">注册时间：</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
              <span className="text-gray-400">-</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
            </div>
            <button
              onClick={handleApplyFilters}
              className="px-8 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
            >
              筛选
            </button>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
            <input
              type="text"
              placeholder="学校"
              value={school}
              onChange={(e) => setSchool(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleApplyFilters()}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
            <select
              value={gender}
              onChange={(e) => setGender(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
            >
              <option value="">性别（全部）</option>
              <option value="男">男</option>
              <option value="女">女</option>
            </select>
            <select
              value={gaokaoProvince}
              onChange={(e) => setGaokaoProvince(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
            >
              <option value="">高考省份（全部）</option>
              {GAOKAO_PROVINCE_OPTIONS.map((province) => (
                <option key={province} value={province}>
                  {province}
                </option>
              ))}
            </select>
            <select
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
            >
              <option value="">可教科目（全部）</option>
              {SUBJECT_OPTIONS.map((subject) => (
                <option key={subject.value} value={subject.value}>
                  {subject.label}
                </option>
              ))}
            </select>
            <input
              type="number"
              inputMode="numeric"
              placeholder="最低高考分"
              value={scoreMin}
              onChange={(e) => setScoreMin(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleApplyFilters()}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
            >
              <option value="">状态（全部）</option>
              {STATUS_OPTIONS.map((status) => (
                <option key={status.value} value={status.value}>
                  {status.label}
                </option>
              ))}
            </select>
            <input
              type="text"
              placeholder="邀请人姓名/手机号"
              value={inviterSearch}
              onChange={(e) => setInviterSearch(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleApplyFilters()}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between mb-4">
        <p className="text-gray-600">共 {initialTeachers.length} 位团队成员</p>
        <button onClick={() => setShowAddModal(true)} className="btn-primary">
          + 添加老师
        </button>
      </div>

      {/* 团队列表 */}
      {initialTeachers.length === 0 ? (
        <div className="card text-center py-16">
          <div className="text-5xl mb-3">👥</div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">团队暂无成员</h2>
          <p className="text-gray-500 mb-4">点击"添加老师"将老师加入你的团队</p>
          <button onClick={() => setShowAddModal(true)} className="btn-primary">
            添加老师
          </button>
        </div>
      ) : (
        <div className="card overflow-hidden p-0">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                {['ID', '姓名', '手机号', '学校', '状态', '当前任务', '注册时间', '操作'].map((h) => (
                  <th
                    key={h}
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {initialTeachers.map((teacher) => (
                <tr
                  key={teacher.id}
                  className="hover:bg-gray-50 cursor-pointer"
                >
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-500">
                    <Link
                      href={`/admin/teachers/${teacher.id}`}
                      className="text-primary-600 hover:underline"
                    >
                      {teacher.id.substring(0, 8)}...
                    </Link>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <Link
                      href={`/admin/teachers/${teacher.id}`}
                      className="text-gray-900 hover:text-primary-600"
                    >
                      {teacher.name || <span className="text-gray-400">未填写</span>}
                    </Link>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{formatPhone(teacher.phone)}</td>
                  <td
                    className="px-6 py-4 whitespace-nowrap text-sm text-gray-600"
                    title={teacher.school || undefined}
                  >
                    {getSchoolDisplayName(teacher.school)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`badge ${
                        teacher.status === 'UNLOCKED'
                          ? 'badge-success'
                          : teacher.status === 'COMPLETED'
                          ? 'badge-primary'
                          : 'badge-gray'
                      }`}
                    >
                      {getTeacherStatusText(teacher.status)}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                    {teacher.currentTaskIndex} / 7
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {formatDateTime(teacher.createdAt)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <div className="flex items-center gap-3">
                      <Link
                        href={`/admin/teachers/${teacher.id}`}
                        className="text-primary-600 hover:text-primary-900 font-medium"
                      >
                        详情
                      </Link>
                      <button
                        onClick={() => handleRemove(teacher.id, teacher.name)}
                        disabled={isPending}
                        className="text-red-500 hover:text-red-700 font-medium"
                      >
                        移除
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 添加老师弹窗 */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg">
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <h3 className="text-lg font-bold text-gray-900">添加老师到团队</h3>
              <button
                onClick={() => {
                  if (searchTimerRef.current) clearTimeout(searchTimerRef.current)
                  setShowAddModal(false)
                  setSearchResults([])
                  setAddKeyword('')
                  setAddMessage('')
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>

            <div className="p-6">
              <p className="mb-3 text-xs text-gray-500">
                认领范围：仅显示当前无跟进人的老师；认领成功后该老师将纳入你的管理范围。手机号已脱敏展示。
              </p>
              {addMessage && (
                <div
                  className={`mb-4 p-3 rounded-lg text-sm ${
                    addMessage.startsWith('✅')
                      ? 'bg-green-50 text-green-700'
                      : 'bg-red-50 text-red-700'
                  }`}
                >
                  {addMessage}
                </div>
              )}

              <div className="relative mb-4">
                <input
                  type="text"
                  value={addKeyword}
                  onChange={(e) => {
                    setAddKeyword(e.target.value)
                    setAddMessage('')
                  }}
                  placeholder="输入姓名 / 手机号 / ID 搜索..."
                  className="input w-full pr-8"
                  autoFocus
                />
                {searching && (
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">
                    搜索中…
                  </span>
                )}
              </div>

              {searchResults.length > 0 && (
                <div className="space-y-2 max-h-72 overflow-y-auto">
                  {searchResults.map((teacher) => {
                    const hasTeam = !!teacher.teamAssignment
                    return (
                      <div
                        key={teacher.id}
                        className="flex items-center justify-between p-3 border border-gray-100 rounded-lg hover:bg-gray-50"
                      >
                        <div>
                          <p className="text-sm font-medium text-gray-900">
                            {teacher.name || '未命名'}
                          </p>
                          <p className="text-xs text-gray-500">{formatPhone(teacher.phone)}</p>
                          {hasTeam && (
                            <p className="text-xs text-orange-500 mt-0.5">
                              已被「{teacher.teamAssignment!.operator.name}」跟进
                            </p>
                          )}
                        </div>
                        <button
                          onClick={() => handleAdd(teacher.id)}
                          disabled={hasTeam}
                          className={`text-sm px-3 py-1.5 rounded-lg font-medium transition-colors ${
                            hasTeam
                              ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                              : 'bg-primary-600 text-white hover:bg-primary-700'
                          }`}
                        >
                          {hasTeam ? '已归属' : '添加'}
                        </button>
                      </div>
                    )
                  })}
                </div>
              )}

              {searchResults.length === 0 && addKeyword && !searching && (
                <p className="text-center text-sm text-gray-400 py-4">未找到匹配的老师</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
