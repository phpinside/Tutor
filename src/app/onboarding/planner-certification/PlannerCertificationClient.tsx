'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  submitLearningPlannerApplication,
  resetLearningPlannerApplication,
} from '@/app/actions/learningPlanner'
import {
  LEARNING_PLANNER_EXPECTED_PDF_NAME,
  LEARNING_PLANNER_STUDENT_PROFILE,
  LEARNING_PLANNER_TEMPLATE_URL,
  getLearningPlannerStatusBadgeClass,
  getLearningPlannerStatusText,
  isValidLearningPlannerPdfName,
} from '@/lib/learningPlanner'
import { formatDateTime } from '@/lib/utils'

type ReviewItem = {
  id: string
  decision: 'APPROVED' | 'REJECTED'
  reason: string | null
  createdAt: string | Date
  operator: { id: string; name: string }
}

type Application = {
  id: string
  status: 'PENDING' | 'APPROVED' | 'REJECTED'
  studyPlanPdfName: string
  trialLessonVideoUrl: string
  statement: string
  approveCount: number
  rejectCount: number
  finalDecisionNote: string | null
  submittedAt: string | Date
  finalReviewedAt: string | Date | null
  reviews: ReviewItem[]
  signedStudyPlanPdfUrl: string
}

export default function PlannerCertificationClient({
  teacherId,
  teacherName,
  application,
}: {
  teacherId: string
  teacherName: string | null
  application: Application | null
}) {
  const router = useRouter()
  const [trialLessonVideoUrl, setTrialLessonVideoUrl] = useState('')
  const [statement, setStatement] = useState('')
  const [studyPlanPdfUrl, setStudyPlanPdfUrl] = useState('')
  const [studyPlanPdfName, setStudyPlanPdfName] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [error, setError] = useState('')
  const [resetting, setResetting] = useState(false)

  const rejectReviews = useMemo(
    () => application?.reviews.filter((r) => r.decision === 'REJECTED') || [],
    [application]
  )

  const handlePdfUpload = async (file: File) => {
    setError('')
    if (!file) return

    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      setError('学习规划书必须为 PDF 格式')
      return
    }
    if (!isValidLearningPlannerPdfName(file.name)) {
      setError(`文件名必须为 ${LEARNING_PLANNER_EXPECTED_PDF_NAME}`)
      return
    }

    setUploading(true)
    setUploadProgress(0)
    try {
      const tokenResponse = await fetch('/api/upload/planner-document-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teacherId, fileName: file.name }),
      })
      const tokenData = await tokenResponse.json()
      if (!tokenResponse.ok) throw new Error(tokenData.error || '获取上传凭证失败')

      const { uploadToken, key, domain, uploadUrl } = tokenData
      const formData = new FormData()
      formData.append('file', file)
      formData.append('token', uploadToken)
      formData.append('key', key)

      const fileUrl = await new Promise<string>((resolve, reject) => {
        const xhr = new XMLHttpRequest()
        xhr.upload.addEventListener('progress', (e) => {
          if (e.lengthComputable) setUploadProgress(Math.round((e.loaded / e.total) * 100))
        })
        xhr.addEventListener('load', () => {
          if (xhr.status === 200) {
            const result = JSON.parse(xhr.responseText)
            resolve(`${domain}/${result.key || key}`)
          } else {
            reject(new Error('上传失败，请重试'))
          }
        })
        xhr.addEventListener('error', () => reject(new Error('网络错误，请检查后重试')))
        xhr.addEventListener('timeout', () => reject(new Error('上传超时，请重试')))
        xhr.open('POST', uploadUrl)
        xhr.timeout = 300000
        xhr.send(formData)
      })

      setStudyPlanPdfUrl(fileUrl)
      setStudyPlanPdfName(file.name)
      setUploadProgress(100)
    } catch (err) {
      setError(err instanceof Error ? err.message : '上传失败，请重试')
    } finally {
      setUploading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError('')

    if (!studyPlanPdfUrl || !studyPlanPdfName) {
      setError('请先上传学习规划书 PDF')
      return
    }
    if (!trialLessonVideoUrl.trim()) {
      setError('请填写腾讯会议录像链接')
      return
    }
    if (!trialLessonVideoUrl.trim().startsWith('https://meeting.tencent.com')) {
      setError('腾讯会议录像链接必须以 https://meeting.tencent.com 开头')
      return
    }
    if (!statement.trim()) {
      setError('请填写个人申请陈述和补充说明')
      return
    }

    setSubmitting(true)
    const result = await submitLearningPlannerApplication({
      studyPlanPdfUrl,
      studyPlanPdfName,
      trialLessonVideoUrl,
      statement,
    })
    setSubmitting(false)

    if (!result.success) {
      setError(result.error || '提交失败，请重试')
      return
    }
    router.refresh()
  }

  const handleResubmit = async () => {
    if (!confirm('确定要重新提交申请吗？原申请记录将被清除。')) return
    setResetting(true)
    const result = await resetLearningPlannerApplication()
    setResetting(false)
    if (!result.success) {
      alert(result.error || '操作失败，请重试')
      return
    }
    router.refresh()
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-fade-in">
      <div>
        <Link href="/onboarding/complete" className="inline-flex items-center text-primary-600 hover:text-primary-700">
          ← 返回
        </Link>
      </div>

      <div className="card">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">学习规划师资格认证</h1>
            <p className="text-gray-600 mt-1 text-sm">
              {teacherName || '老师'}，请按要求提交学习规划书、试听课录像和个人申请说明。
            </p>
          </div>
          {application && (
            <span className={`badge text-sm ${getLearningPlannerStatusBadgeClass(application.status)}`}>
              {getLearningPlannerStatusText(application.status)}
            </span>
          )}
        </div>
      </div>

      {application ? (
        <div className="space-y-6">
          {/* 审核状态 */}
          <div className="card">
            {application.status === 'PENDING' && (
              <div className="rounded-xl bg-amber-50 border border-amber-200 p-6">
                <h3 className="text-lg font-semibold text-amber-900 mb-1">已经收到您的申请，请耐心等待！</h3>
                <p className="text-amber-800 text-sm">预计需要 1-3 天完成审核</p>
              </div>
            )}
            {application.status === 'APPROVED' && (
              <div className="rounded-xl bg-green-50 border border-green-200 p-6">
                <h3 className="text-lg font-semibold text-green-900 mb-1">审核通过，恭喜你已经成为学习规划师！</h3>
                <p className="text-green-800 text-sm">后续可继续按平台流程开展学习规划相关工作。</p>
              </div>
            )}
            {application.status === 'REJECTED' && (
              <div className="rounded-xl bg-red-50 border border-red-200 p-6 space-y-4">
                <div>
                  <h3 className="text-lg font-semibold text-red-900 mb-1">暂未通过，请继续努力。</h3>
                  <p className="text-red-800 text-sm">评委老师意见如下：</p>
                </div>
                <div className="bg-white rounded-lg border border-red-100 p-4 text-sm text-gray-700 whitespace-pre-wrap">
                  {application.finalDecisionNote || '暂无详细意见'}
                </div>
                <button
                  onClick={handleResubmit}
                  disabled={resetting}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-300 text-white text-sm font-medium rounded-lg transition-colors"
                >
                  {resetting ? '处理中...' : '重新提交申请'}
                </button>
              </div>
            )}

            <div className="grid gap-3  mt-5">
              <div className="rounded-lg bg-gray-50 p-3 text-sm">
                <p className="text-gray-500 mb-1">申请时间</p>
                <p className="font-medium text-gray-900">{formatDateTime(application.submittedAt)}</p>
              </div>
            </div>
          </div>

          {/* 已提交材料 */}
          <div className="card space-y-4">
            <h2 className="text-lg font-semibold text-gray-900">已提交材料</h2>
            <div className="grid gap-4 md:grid-cols-2 text-sm">
              <div>
                <p className="text-gray-500 mb-1">学习规划书</p>
                <a
                  href={application.signedStudyPlanPdfUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary-600 hover:text-primary-700 font-medium"
                >
                  {application.studyPlanPdfName}
                </a>
              </div>
              <div>
                <p className="text-gray-500 mb-1">腾讯会议录像</p>
                <a
                  href={application.trialLessonVideoUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary-600 hover:text-primary-700 font-medium break-all"
                >
                  查看录像链接
                </a>
              </div>
            </div>
            <div className="text-sm">
              <p className="text-gray-500 mb-1">个人申请陈述</p>
              <div className="rounded-lg bg-gray-50 p-4 whitespace-pre-wrap text-gray-700">
                {application.statement}
              </div>
            </div>
          </div>

          {/* 评审意见（仅不通过时显示） */}
          {rejectReviews.length > 0 && (
            <div className="card">
              <h2 className="text-lg font-semibold text-gray-900 mb-3">评审意见</h2>
              <div className="space-y-3">
                {rejectReviews.map((review) => (
                  <div key={review.id} className="rounded-lg border border-gray-200 p-4 text-sm">
                    <div className="flex items-center justify-between gap-3 mb-2">
                      <span className="font-medium text-gray-900">{review.operator.name}</span>
                      <span className="text-gray-500">{formatDateTime(review.createdAt)}</span>
                    </div>
                    <p className="text-gray-700 whitespace-pre-wrap">{review.reason || '未填写具体意见'}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="card space-y-8">
          <h2 className="text-lg font-semibold text-gray-900">提交认证材料</h2>

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {/* 1. 学习规划书上传 */}
          <div className="space-y-3">
            <label className="block text-sm font-medium text-gray-700">
              1. 上传学习规划书（PDF）
            </label>

            <input
              type="file"
              accept=".pdf,application/pdf"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) handlePdfUpload(file)
              }}
              className="block w-full text-sm text-gray-700"
              disabled={uploading || submitting}
            />

            {uploading && (
              <p className="text-sm text-primary-600">上传中... {uploadProgress}%</p>
            )}
            {studyPlanPdfName && (
              <p className="text-sm text-green-700">✓ 已上传：{studyPlanPdfName}</p>
            )}

            {/* 补充说明 */}
            <div className="rounded-lg bg-blue-50 border border-blue-100 p-4 space-y-3 text-sm">
              <div>
                <p className="font-medium text-blue-900 mb-1">说明</p>
                <ul className="text-blue-800 space-y-1">
                  <li>· 文件格式：PDF，文件名为 <span className="font-semibold">{LEARNING_PLANNER_EXPECTED_PDF_NAME}</span></li>
                  <li>
                    · 参考模板：
                    <a
                      href={LEARNING_PLANNER_TEMPLATE_URL}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline hover:text-blue-700 ml-1"
                    >
                      打开飞书模板文档
                    </a>
                  </li>
                </ul>
              </div>

              <div>
                <p className="font-medium text-blue-900 mb-2">参考学生情况</p>
                <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-blue-800">
                  {LEARNING_PLANNER_STUDENT_PROFILE.map((item) => (
                    <div key={item.label} className="flex gap-1">
                      <span className="text-blue-600 shrink-0">{item.label}：</span>
                      <span>{item.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* 2. 腾讯会议录像链接 */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">
              2. 腾讯会议录像链接
            </label>
            <input
              type="url"
              value={trialLessonVideoUrl}
              onChange={(e) => setTrialLessonVideoUrl(e.target.value)}
              placeholder="请填写长期有效、无密码的腾讯会议录像链接"
              className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm ${
                trialLessonVideoUrl && !trialLessonVideoUrl.startsWith('https://meeting.tencent.com')
                  ? 'border-red-400 bg-red-50'
                  : 'border-gray-300'
              }`}
              disabled={submitting}
            />
            {trialLessonVideoUrl && !trialLessonVideoUrl.startsWith('https://meeting.tencent.com') && (
              <p className="text-xs text-red-500">
                链接必须以 https://meeting.tencent.com 开头
              </p>
            )}
            <p className="text-xs text-gray-500">
              请按试听课要求完成模拟上课，录像设置为长期有效且不设密码。
            </p>
          </div>

          {/* 3. 个人申请陈述 */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">
              3. 个人申请陈述和补充说明
            </label>
            <textarea
              value={statement}
              onChange={(e) => setStatement(e.target.value)}
              rows={6}
              placeholder="请说明你的学习规划能力、试听课准备情况，以及希望补充给评审老师的信息。"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none text-sm"
              disabled={submitting}
            />
          </div>

          <button
            type="submit"
            disabled={submitting || uploading}
            className="btn-primary disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            {submitting ? '提交中...' : '提交申请'}
          </button>
        </form>
      )}
    </div>
  )
}
