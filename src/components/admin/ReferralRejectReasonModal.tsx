'use client'

import { useEffect, useState } from 'react'
import { DEFAULT_REFERRAL_REJECT_REASON } from '@/lib/referralAudit'

type ReferralRejectReasonModalProps = {
  open: boolean
  onClose: () => void
  /** 返回 true 表示已成功处理，弹窗将关闭 */
  onConfirm: (reason: string) => Promise<boolean>
  /** 打开时预填内容；不传则使用系统默认模板 */
  initialText?: string | null
}

export default function ReferralRejectReasonModal({
  open,
  onClose,
  onConfirm,
  initialText,
}: ReferralRejectReasonModalProps) {
  const [text, setText] = useState(DEFAULT_REFERRAL_REJECT_REASON)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!open) return
    setText(
      initialText != null && initialText !== ''
        ? initialText.replace(/\r\n/g, '\n')
        : DEFAULT_REFERRAL_REJECT_REASON
    )
  }, [open, initialText])

  if (!open) return null

  const handleSubmit = async () => {
    const normalized = text.replace(/\r\n/g, '\n')
    if (!normalized.trim()) {
      alert('请填写不通过理由')
      return
    }
    setSubmitting(true)
    try {
      const ok = await onConfirm(normalized)
      if (ok) onClose()
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40"
      role="dialog"
      aria-modal="true"
      aria-labelledby="referral-reject-reason-title"
      onClick={(e) => {
        if (e.target === e.currentTarget && !submitting) onClose()
      }}
    >
      <div
        className="bg-white rounded-lg shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <h3
          id="referral-reject-reason-title"
          className="text-lg font-semibold text-gray-900 px-4 py-3 border-b border-gray-200"
        >
          审核不通过理由
        </h3>
        <div className="p-4 flex-1 min-h-0 overflow-y-auto">
          <label htmlFor="referral-reject-reason" className="sr-only">
            不通过理由
          </label>
          <textarea
            id="referral-reject-reason"
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={12}
            className="w-full min-h-[240px] px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm text-gray-900"
            placeholder="可换行编辑，提交后将原样保存与展示（含段尾换行）"
          />
        </div>
        <div className="px-4 py-3 border-t border-gray-200 flex justify-end gap-2 shrink-0">
          <button
            type="button"
            onClick={() => !submitting && onClose()}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-50"
            disabled={submitting}
          >
            取消
          </button>
          <button
            type="button"
            onClick={() => void handleSubmit()}
            className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50"
            disabled={submitting}
          >
            {submitting ? '提交中…' : '提交'}
          </button>
        </div>
      </div>
    </div>
  )
}
