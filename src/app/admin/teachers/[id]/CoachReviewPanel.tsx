'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import ReferralRejectReasonModal from '@/components/admin/ReferralRejectReasonModal'
import {
  submitFirstReview,
  submitFinalReview,
  updateFirstReviewer,
  challengeCoachReview,
} from '@/app/actions/coachReview'
import type { CoachReviewSnapshot } from '@/lib/coachReviewShared'
import { formatDateTime } from '@/lib/utils'
import { QUALIFICATION_TYPE_LABELS } from '@/lib/teacherQualificationShared'
import type { QualificationType } from '@/lib/teacherQualificationShared'
import OperatorPickerModal from './OperatorPickerModal'

type Viewer = {
  operatorId: string | null
  isSuperAdmin: boolean
  canFinalReview: boolean
}

type RejectTarget =
  | { type: 'first' | 'final'; reviewId: string; permanent: boolean }
  | null

const STAGE_LABELS: Record<string, string> = {
  FIRST_REVIEW: '待初审',
  FINAL_REVIEW: '待复审',
  CHALLENGED: '质疑取证中',
  APPROVED: '审核通过',
  REJECTED: '已驳回',
  PERMANENTLY_REJECTED: '已永久拒绝',
}

const VERDICT_LABELS: Record<string, string> = {
  PENDING: '待处理',
  APPROVED: '通过',
  REJECTED: '驳回',
  SKIPPED: '跳过',
}

export default function CoachReviewPanel({
  review,
  viewer,
}: {
  review: CoachReviewSnapshot
  viewer: Viewer
}) {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [rejectTarget, setRejectTarget] = useState<RejectTarget>(null)
  const [challengeOpen, setChallengeOpen] = useState(false)
  const [challengeItems, setChallengeItems] = useState<QualificationType[]>(['GAOKAO_SCORE'])
  const [challengeNote, setChallengeNote] = useState('')
  const [error, setError] = useState<string | null>(null)

  const isFirstReviewer =
    viewer.operatorId !== null &&
    review.firstReviewOperatorId === viewer.operatorId

  const canDoFirstReview =
    isFirstReviewer &&
    review.stage === 'FIRST_REVIEW' &&
    review.firstReviewVerdict === 'PENDING' &&
    review.finalReviewVerdict === 'PENDING'

  const canDoFinalReview =
    (viewer.canFinalReview ||
      (viewer.operatorId !== null && review.finalReviewOperatorId === viewer.operatorId)) &&
    review.finalReviewVerdict === 'PENDING'

  const canShortcutFirstStage =
    canDoFinalReview &&
    review.stage === 'FIRST_REVIEW' &&
    review.firstReviewOperatorId !== null &&
    review.firstReviewVerdict === 'PENDING'

  const handleFirstApprove = async () => {
    if (!confirm('确认初审通过？')) return
    setIsLoading(true)
    setError(null)
    const result = await submitFirstReview(review.id, 'APPROVED')
    setIsLoading(false)
    if (result.success) {
      router.refresh()
    } else {
      setError(result.error || '操作失败')
    }
  }

  const handleFinalApprove = async () => {
    const label = canShortcutFirstStage
      ? '确认直接终审通过？（初审将被标记为跳过）'
      : '确认复审通过？'
    if (!confirm(label)) return
    setIsLoading(true)
    setError(null)
    const result = await submitFinalReview(review.id, 'APPROVED')
    setIsLoading(false)
    if (result.success) {
      router.refresh()
    } else {
      setError(result.error || '操作失败')
    }
  }

  const handleRejectConfirm = async (reason: string): Promise<boolean> => {
    if (!rejectTarget) return false
    setIsLoading(true)
    setError(null)
    const decision = rejectTarget.permanent ? 'PERMANENTLY_REJECTED' : 'REJECTED'
    const result =
      rejectTarget.type === 'first'
        ? await submitFirstReview(rejectTarget.reviewId, decision, reason)
        : await submitFinalReview(rejectTarget.reviewId, decision, reason)
    setIsLoading(false)
    if (result.success) {
      router.refresh()
      return true
    }
    setError(result.error || '操作失败')
    return false
  }

  const handleChallengeSubmit = async (): Promise<boolean> => {
    setIsLoading(true)
    setError(null)
    const result = await challengeCoachReview(review.id, challengeItems, challengeNote)
    setIsLoading(false)
    if (result.success) {
      setChallengeOpen(false)
      setChallengeNote('')
      setChallengeItems(['GAOKAO_SCORE'])
      router.refresh()
      return true
    }
    setError(result.error || '操作失败')
    return false
  }

  const stageBadgeClass =
    review.stage === 'APPROVED'
      ? 'bg-success-100 text-success-800'
      : review.stage === 'REJECTED' || review.stage === 'PERMANENTLY_REJECTED'
        ? 'bg-red-100 text-red-800'
        : review.stage === 'CHALLENGED'
          ? 'bg-orange-100 text-orange-800'
          : 'bg-amber-100 text-amber-800'

  const canChallengeFinal = canDoFinalReview && review.stage === 'FINAL_REVIEW'

  return (
    <div className="card mb-8">
      <ReferralRejectReasonModal
        open={rejectTarget !== null}
        onClose={() => setRejectTarget(null)}
        onConfirm={handleRejectConfirm}
        title={rejectTarget?.permanent ? '永久拒绝入驻' : undefined}
        warning={
          rejectTarget?.permanent
            ? '该操作不可逆：教练将被永久拒绝入驻，其手机号将无法登录或重新注册。请谨慎操作。'
            : undefined
        }
        initialText={rejectTarget?.permanent ? '' : null}
      />

      {/* 质疑取证弹窗 */}
      {challengeOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="p-5 border-b border-gray-100">
              <h3 className="text-base font-bold text-gray-900">质疑取证</h3>
              <p className="text-sm text-gray-500 mt-1">
                将入驻申请打回，要求教练补交指定证明材料；补齐后重新提交，由您继续审核。
              </p>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <p className="text-sm font-medium text-gray-700 mb-2">要求补交的证明（可多选）</p>
                <div className="space-y-2">
                  <label className="flex items-start gap-2 text-sm text-gray-700 cursor-not-allowed">
                    <input type="checkbox" checked disabled className="mt-0.5" />
                    <span>
                      {QUALIFICATION_TYPE_LABELS.GAOKAO_SCORE}
                      <span className="ml-1 text-xs text-gray-400">（默认必选）</span>
                    </span>
                  </label>
                  {(['DEGREE_CERT', 'TEACHER_CERT', 'MANDARIN_CERT'] as QualificationType[]).map(
                    (type) => (
                      <label key={type} className="flex items-start gap-2 text-sm text-gray-700 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={challengeItems.includes(type)}
                          onChange={(e) =>
                            setChallengeItems((prev) =>
                              e.target.checked ? [...prev, type] : prev.filter((t) => t !== type)
                            )
                          }
                          className="mt-0.5"
                        />
                        <span>{QUALIFICATION_TYPE_LABELS[type]}</span>
                      </label>
                    )
                  )}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  质疑说明（必填，教练可见）
                </label>
                <textarea
                  value={challengeNote}
                  onChange={(e) => setChallengeNote(e.target.value)}
                  rows={3}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-primary-400 focus:outline-none resize-none"
                  placeholder="例如：数学成绩与提交的视频水平差距较大，请提供高考成绩查询结果予以证明"
                />
              </div>
            </div>
            <div className="p-5 border-t border-gray-100 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setChallengeOpen(false)}
                disabled={isLoading}
                className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 text-sm hover:bg-gray-50 disabled:opacity-50"
              >
                取消
              </button>
              <button
                type="button"
                onClick={handleChallengeSubmit}
                disabled={isLoading || !challengeNote.trim()}
                className="px-4 py-2 rounded-lg bg-orange-600 hover:bg-orange-700 text-white text-sm font-medium disabled:opacity-50"
              >
                {isLoading ? '处理中…' : '打回并要求补证'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between mb-4">
        <h2 className="text-xl font-bold text-gray-900">教练审核</h2>
        <span
          className={`inline-flex items-center w-fit px-2.5 py-0.5 rounded-full text-xs font-medium ${stageBadgeClass}`}
        >
          {STAGE_LABELS[review.stage] || review.stage}
        </span>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-800">
          {error}
        </div>
      )}

      <div className="text-sm text-gray-600 space-y-1 mb-6">
        <p>
          <span className="text-gray-500">审核模式：</span>
          {review.firstReviewOperatorId
            ? `两级审核（初审：${review.firstReviewOperatorName || '运营'}）`
            : '合并审核（初审+复审）'}
        </p>
        <p>
          <span className="text-gray-500">返工轮次：</span>
          第 {review.attemptCount} 次
        </p>
        {review.resolvedManagerPhone && (
          <p>
            <span className="text-gray-500">解析学管手机号：</span>
            {review.resolvedManagerPhone}
          </p>
        )}
      </div>

      {/* 初审信息 */}
      <div className="mb-4 p-3 rounded-lg border border-gray-200 bg-gray-50">
        <div className="flex items-center justify-between mb-1">
          <p className="text-sm font-medium text-gray-700">初审</p>
          {viewer.isSuperAdmin && (
            <OperatorPickerModal
              triggerLabel="修改初审负责人"
              title="修改初审负责人"
              description="修改后，跟进人将同步更新为所选运营账号。设为合并审核（清除）则不影响现有跟进人。"
              currentOperator={
                review.firstReviewOperatorId
                  ? {
                      id: review.firstReviewOperatorId,
                      name: review.firstReviewOperatorName || '未知',
                    }
                  : null
              }
              currentLabel="当前初审负责人"
              emptyLabel="当前为合并审核模式（无初审负责人）"
              allowClear
              clearLabel="设为合并审核"
              clearSuccessMessage="已设为合并审核模式"
              onSubmit={(operatorId) => updateFirstReviewer(review.teacherId, operatorId)}
              successMessagePrefix="已将初审负责人设置为："
              buttonClassName="px-3 py-1 text-xs font-medium text-teal-700 bg-teal-50 rounded-lg hover:bg-teal-100 transition-colors"
            />
          )}
        </div>
        <div className="text-xs text-gray-600 space-y-0.5">
          <p>
            结论：{VERDICT_LABELS[review.firstReviewVerdict] || review.firstReviewVerdict}
            {review.firstReviewedBy && `（${review.firstReviewedBy}）`}
          </p>
          {review.firstReviewedAt && (
            <p>时间：{formatDateTime(review.firstReviewedAt)}</p>
          )}
          {review.firstReviewNote && (
            <p className="mt-1 whitespace-pre-wrap text-gray-800">
              {review.firstReviewNote}
            </p>
          )}
        </div>
      </div>

      {/* 复审信息 */}
      <div className="mb-6 p-3 rounded-lg border border-gray-200 bg-gray-50">
        <p className="text-sm font-medium text-gray-700 mb-1">复审</p>
        <div className="text-xs text-gray-600 space-y-0.5">
          <p>
            复审负责人：
            {review.finalReviewOperatorName || '超管'}
          </p>
          <p>
            结论：{VERDICT_LABELS[review.finalReviewVerdict] || review.finalReviewVerdict}
            {review.finalReviewedBy && `（${review.finalReviewedBy}）`}
          </p>
          {review.finalReviewedAt && (
            <p>时间：{formatDateTime(review.finalReviewedAt)}</p>
          )}
          {review.finalReviewNote && (
            <p className="mt-1 whitespace-pre-wrap text-gray-800">
              {review.finalReviewNote}
            </p>
          )}
        </div>
      </div>

      {/* 操作按钮 */}
      {review.stage !== 'APPROVED' && review.stage !== 'REJECTED' && review.stage !== 'PERMANENTLY_REJECTED' && (canDoFirstReview || canDoFinalReview) && (
        <div className="flex flex-col sm:flex-row gap-3">
          {canDoFirstReview && (
            <>
              <button
                type="button"
                onClick={handleFirstApprove}
                disabled={isLoading}
                className="px-4 py-2 text-sm font-medium rounded-lg bg-success-100 text-success-700 hover:bg-success-200 disabled:opacity-50 transition-colors"
              >
                初审通过
              </button>
              <button
                type="button"
                onClick={() =>
                  setRejectTarget({ type: 'first', reviewId: review.id, permanent: false })
                }
                disabled={isLoading}
                className="px-4 py-2 text-sm font-medium rounded-lg bg-red-100 text-red-700 hover:bg-red-200 disabled:opacity-50 transition-colors"
              >
                初审驳回
              </button>
              <button
                type="button"
                onClick={() =>
                  setRejectTarget({ type: 'first', reviewId: review.id, permanent: true })
                }
                disabled={isLoading}
                className="px-4 py-2 text-sm font-medium rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 transition-colors"
              >
                永久拒绝入驻
              </button>
              <button
                type="button"
                onClick={() => setChallengeOpen(true)}
                disabled={isLoading}
                className="px-4 py-2 text-sm font-medium rounded-lg bg-orange-100 text-orange-700 hover:bg-orange-200 disabled:opacity-50 transition-colors"
              >
                质疑取证
              </button>
            </>
          )}
          {canDoFinalReview && (
            <>
              <button
                type="button"
                onClick={handleFinalApprove}
                disabled={isLoading}
                className="px-4 py-2 text-sm font-medium rounded-lg bg-success-100 text-success-700 hover:bg-success-200 disabled:opacity-50 transition-colors"
              >
                {canShortcutFirstStage ? '直接终审通过' : '复审通过'}
              </button>
              <button
                type="button"
                onClick={() =>
                  setRejectTarget({ type: 'final', reviewId: review.id, permanent: false })
                }
                disabled={isLoading}
                className="px-4 py-2 text-sm font-medium rounded-lg bg-red-100 text-red-700 hover:bg-red-200 disabled:opacity-50 transition-colors"
              >
                {canShortcutFirstStage ? '直接终审驳回' : '复审驳回'}
              </button>
              <button
                type="button"
                onClick={() =>
                  setRejectTarget({ type: 'final', reviewId: review.id, permanent: true })
                }
                disabled={isLoading}
                className="px-4 py-2 text-sm font-medium rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 transition-colors"
              >
                永久拒绝入驻
              </button>
              {canChallengeFinal && (
                <button
                  type="button"
                  onClick={() => setChallengeOpen(true)}
                  disabled={isLoading}
                  className="px-4 py-2 text-sm font-medium rounded-lg bg-orange-100 text-orange-700 hover:bg-orange-200 disabled:opacity-50 transition-colors"
                >
                  质疑取证
                </button>
              )}
            </>
          )}
        </div>
      )}

      {review.stage === 'CHALLENGED' && (
        <div className="rounded-lg border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-900">
          <p className="font-medium text-orange-950 mb-1">质疑取证中，等待教练补交材料</p>
          <p className="text-orange-800">
            教练补齐材料并重新提交后，将回到{review.challengeFromStage === 'FINAL_REVIEW' ? '复审' : '初审'}由您继续审核。
          </p>
        </div>
      )}

      {review.stage === 'REJECTED' && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <p className="font-medium text-amber-950 mb-1">已驳回，等待教练修改</p>
          <p className="text-amber-800">
            教练修改后将自动重新进入初审流程。
          </p>
        </div>
      )}

      {review.stage === 'PERMANENTLY_REJECTED' && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
          <p className="font-medium text-red-950 mb-1">已永久拒绝入驻</p>
          <p className="text-red-800">
            该教练已被永久拒绝入驻，其手机号将无法登录或重新注册。此操作不可逆。
          </p>
        </div>
      )}
    </div>
  )
}
