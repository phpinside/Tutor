'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { reviewLearningPlannerApplication } from '@/app/actions/learningPlanner'
import {
  getLearningPlannerStatusBadgeClass,
  getLearningPlannerStatusText,
} from '@/lib/learningPlanner'
import { formatDateTime } from '@/lib/utils'

type Application = {
  id: string
  status: 'PENDING' | 'APPROVED' | 'REJECTED'
  studyPlanPdfName: string
  trialLessonVideoUrl: string
  statement: string
  approveCount: number
  rejectCount: number
  submittedAt: string | Date
  finalReviewedAt: string | Date | null
  signedStudyPlanPdfUrl: string
  teacher: {
    id: string
    name: string | null
    school: string | null
    mathScore: number | null
  }
  currentOperatorReview: {
    id: string
    decision: 'APPROVED' | 'REJECTED'
    reason: string | null
    createdAt: string | Date
  } | null
}

export default function PlannerReviewManagementClient({
  initialApplications,
  initialFilters,
  stats,
}: {
  initialApplications: Application[]
  initialFilters: {
    search?: string
    reviewStatus?: string
    startDate?: string
    endDate?: string
  }
  stats: {
    total: number
    pending: number
    reviewed: number
  }
}) {
  const router = useRouter()
  const [searchTerm, setSearchTerm] = useState(initialFilters.search || '')
  const [reviewStatus, setReviewStatus] = useState(initialFilters.reviewStatus || 'all')
  const [startDate, setStartDate] = useState(initialFilters.startDate || '')
  const [endDate, setEndDate] = useState(initialFilters.endDate || '')
  const [isLoading, setIsLoading] = useState(false)
  const [rejectModal, setRejectModal] = useState<{ id: string; teacherName: string | null } | null>(null)
  const [rejectReason, setRejectReason] = useState('')

  const handleApplyFilters = () => {
    const params = new URLSearchParams()
    if (searchTerm) params.set('search', searchTerm)
    if (reviewStatus !== 'all') params.set('reviewStatus', reviewStatus)
    if (startDate) params.set('startDate', startDate)
    if (endDate) params.set('endDate', endDate)
    router.push(`/operator/planner-review?${params.toString()}`)
  }

  const handleReset = () => {
    setSearchTerm('')
    setReviewStatus('all')
    setStartDate('')
    setEndDate('')
    router.push('/operator/planner-review')
  }

  const handleApprove = async (applicationId: string) => {
    if (!confirm('确认通过该老师的学习规划师资格认证评审？')) return

    setIsLoading(true)
    const result = await reviewLearningPlannerApplication(applicationId, 'APPROVED')
    setIsLoading(false)

    if (!result.success) {
      alert(result.error || '操作失败，请重试')
      return
    }

    router.refresh()
  }

  const handleReject = async () => {
    if (!rejectModal) return

    if (!rejectReason.trim()) {
      alert('请填写不通过原因和描述')
      return
    }

    setIsLoading(true)
    const result = await reviewLearningPlannerApplication(
      rejectModal.id,
      'REJECTED',
      rejectReason
    )
    setIsLoading(false)

    if (!result.success) {
      alert(result.error || '操作失败，请重试')
      return
    }

    setRejectModal(null)
    setRejectReason('')
    router.refresh()
  }

  const statCards = useMemo(
    () => [
      { label: '全部申请', value: stats.total },
      { label: '待审核', value: stats.pending },
      { label: '已审核', value: stats.reviewed },
    ],
    [stats]
  )

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        {statCards.map((item) => (
          <div key={item.label} className="card">
            <p className="text-sm text-gray-500 mb-2">{item.label}</p>
            <p className="text-3xl font-bold text-gray-900">{item.value}</p>
          </div>
        ))}
      </div>

      <div className="card">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <input
                type="text"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                onKeyPress={(event) => event.key === 'Enter' && handleApplyFilters()}
                placeholder="搜索姓名..."
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <select
              value={reviewStatus}
              onChange={(event) => setReviewStatus(event.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
            >
              <option value="all">审核状态（全部）</option>
              <option value="reviewed">已审核</option>
              <option value="pending">待审核</option>
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
              <label className="text-sm text-gray-600 whitespace-nowrap">申请时间：</label>
              <input
                type="date"
                value={startDate}
                onChange={(event) => setStartDate(event.target.value)}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
              <span className="text-gray-400">-</span>
              <input
                type="date"
                value={endDate}
                onChange={(event) => setEndDate(event.target.value)}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
            </div>
            <button onClick={handleApplyFilters} className="btn-primary">
              筛选
            </button>
          </div>
        </div>
      </div>

      {initialApplications.length === 0 ? (
        <div className="card text-center py-16">
          <div className="text-5xl mb-3">🗂️</div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">暂无符合条件的申请</h2>
          <p className="text-gray-500">请尝试调整筛选条件</p>
        </div>
      ) : (
        <div className="card overflow-hidden p-0">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                {[
                  '姓名',
                  '学校',
                  '高考数学分数',
                  '学习规划书',
                  '试听课录像',
                  '申请陈述',
                  '审核时间',
                  '操作',
                ].map((header) => (
                  <th
                    key={header}
                    className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                  >
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {initialApplications.map((application) => {
                const currentReview = application.currentOperatorReview
                const hasReviewed = Boolean(currentReview)
                const canReview = application.status === 'PENDING' && !hasReviewed && !isLoading

                return (
                  <tr key={application.id} className="hover:bg-gray-50">
                    <td className="px-4 py-4 align-top">
                      <Link
                        href={`/admin/teachers/${application.teacher.id}`}
                        className="font-medium text-primary-600 hover:text-primary-700"
                      >
                        {application.teacher.name || '未填写'}
                      </Link>
                    </td>
                    <td className="px-4 py-4 align-top text-sm text-gray-700">
                      {application.teacher.school || '未填写'}
                    </td>
                    <td className="px-4 py-4 align-top text-sm text-gray-700">
                      {application.teacher.mathScore ? `${application.teacher.mathScore} 分` : '未填写'}
                    </td>
                    <td className="px-4 py-4 align-top text-sm">
                      <a
                        href={application.signedStudyPlanPdfUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary-600 hover:text-primary-700"
                      >
                        {application.studyPlanPdfName}
                      </a>
                    </td>
                    <td className="px-4 py-4 align-top text-sm">
                      <a
                        href={application.trialLessonVideoUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary-600 hover:text-primary-700"
                      >
                        查看录像
                      </a>
                    </td>
                    <td className="px-4 py-4 align-top text-sm text-gray-700 max-w-sm">
                      <div className="relative group">
                        <div className="line-clamp-4 whitespace-pre-wrap">{application.statement}</div>
                        <div className="absolute left-0 top-0 z-50 hidden group-hover:block w-96 max-h-80 overflow-y-auto rounded-lg border border-gray-200 bg-white p-4 shadow-xl text-sm text-gray-700 whitespace-pre-wrap">
                          {application.statement}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4 align-top text-sm text-gray-700 whitespace-nowrap">
                      {application.finalReviewedAt
                        ? formatDateTime(application.finalReviewedAt)
                        : '—'}
                    </td>
                    <td className="px-4 py-4 align-top">
                      <div className="space-y-3 min-w-[200px]">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`badge text-xs ${getLearningPlannerStatusBadgeClass(application.status)}`}>
                            {getLearningPlannerStatusText(application.status)}
                          </span>
                          <span className="text-xs text-gray-500">
                            通过 {application.approveCount} / 不通过 {application.rejectCount}
                          </span>
                        </div>

                        {currentReview && (
                          <div className="rounded-lg bg-gray-50 p-3 text-xs text-gray-600">
                            你已审核：
                            {currentReview.decision === 'APPROVED' ? '通过' : '不通过'}
                          </div>
                        )}

                        {application.status !== 'PENDING' && !currentReview && (
                          <div className="rounded-lg bg-gray-50 p-3 text-xs text-gray-600">
                            该申请已完成终审
                          </div>
                        )}

                        <div className="flex gap-2">
                          <button
                            onClick={() => handleApprove(application.id)}
                            disabled={!canReview}
                            className="px-3 py-2 rounded-lg bg-green-600 text-white text-sm hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
                          >
                            通过
                          </button>
                          <button
                            onClick={() => {
                              setRejectModal({
                                id: application.id,
                                teacherName: application.teacher.name,
                              })
                              setRejectReason('')
                            }}
                            disabled={!canReview}
                            className="px-3 py-2 rounded-lg bg-red-600 text-white text-sm hover:bg-red-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
                          >
                            不通过
                          </button>
                        </div>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {rejectModal && (
        <div
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
          onClick={() => setRejectModal(null)}
        >
          <div
            className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6"
            onClick={(event) => event.stopPropagation()}
          >
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              填写不通过原因
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              请为 {rejectModal.teacherName || '该老师'} 填写审核不通过的理由和补充描述。
            </p>
            <textarea
              value={rejectReason}
              onChange={(event) => setRejectReason(event.target.value)}
              rows={5}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none"
              placeholder="请输入不通过的理由和建议..."
            />
            <div className="flex justify-end gap-3 mt-4">
              <button
                onClick={() => setRejectModal(null)}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                取消
              </button>
              <button
                onClick={handleReject}
                disabled={isLoading}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:bg-gray-300"
              >
                {isLoading ? '提交中...' : '确认不通过'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
