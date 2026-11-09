'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { directApproveTeacher } from '@/app/actions/coachReview'
import { getTeacherStatusText } from '@/lib/utils'

export default function DirectApproveSection({
  teacherId,
  teacherStatus,
  hasCoachReview,
}: {
  teacherId: string
  teacherStatus: string
  hasCoachReview: boolean
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [note, setNote] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isAbnormalStatus =
    teacherStatus !== 'COMPLETED' && teacherStatus !== 'UNLOCKED'

  const handleConfirm = async () => {
    setIsLoading(true)
    setError(null)
    const result = await directApproveTeacher(teacherId, note.trim() || undefined)
    setIsLoading(false)
    if (result.success) {
      setOpen(false)
      setNote('')
      router.refresh()
    } else {
      setError(result.error || '操作失败')
    }
  }

  return (
    <div className="card mb-8 border-amber-200 bg-amber-50/50">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-base font-bold text-gray-900">直接通过</h2>
          <div className="mt-1 text-sm text-gray-600 space-y-0.5">
            <p>
              当前入驻状态：
              <span
                className={
                  isAbnormalStatus ? 'text-amber-700 font-medium' : 'text-gray-800'
                }
              >
                {getTeacherStatusText(teacherStatus)}
                {isAbnormalStatus ? '（未走完入驻流程）' : ''}
              </span>
            </p>
            <p>将跳过任务流程与两级审核，直接标记为审核通过，并归正入驻状态、同步邀请奖励记录。该操作会写入审计日志。</p>
            {hasCoachReview && (
              <p>该教练已有审核记录，直接通过将覆盖未完成的审核流程（初审标记为跳过）。</p>
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="w-fit px-4 py-2 text-sm font-medium rounded-lg bg-success-100 text-success-700 hover:bg-success-200 transition-colors shrink-0"
        >
          直接通过
        </button>
      </div>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="p-5 border-b border-gray-100">
              <h3 className="text-base font-bold text-gray-900">确认直接通过？</h3>
              <p className="text-sm text-gray-500 mt-1">
                将跳过任务流程与两级审核，直接标记为审核通过，并归正入驻状态、同步邀请奖励记录。
              </p>
            </div>
            <div className="p-5 space-y-4">
              {error && (
                <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-800">
                  {error}
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  备注（可选，仅记录在审核与审计日志中）
                </label>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={3}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-primary-400 focus:outline-none resize-none"
                  placeholder="例如：早期入驻教练，未走完整入驻流程，现补录为已通过"
                />
              </div>
            </div>
            <div className="p-5 border-t border-gray-100 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setOpen(false)}
                disabled={isLoading}
                className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 text-sm hover:bg-gray-50 disabled:opacity-50"
              >
                取消
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                disabled={isLoading}
                className="px-4 py-2 rounded-lg bg-success-600 hover:bg-success-700 text-white text-sm font-medium disabled:opacity-50"
              >
                {isLoading ? '处理中…' : '确认通过'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
