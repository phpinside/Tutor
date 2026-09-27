'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { updateFinalReviewSwitch } from '@/app/actions/coachReviewConfigActions'

export default function FinalReviewPermissionCard({
  initialEnabled,
}: {
  initialEnabled: boolean
}) {
  const router = useRouter()
  const [enabled, setEnabled] = useState(initialEnabled)
  const [message, setMessage] = useState('')
  const [pending, startTransition] = useTransition()

  const toggle = async () => {
    const next = !enabled
    const result = await updateFinalReviewSwitch(next)
    if (result.success) {
      setEnabled(next)
      setMessage('✅ 已保存，即时生效')
      startTransition(() => router.refresh())
    } else {
      setMessage(`❌ ${result.error ?? '保存失败'}`)
    }
  }

  return (
    <div className="card hover:shadow-md transition-shadow flex items-center gap-4 p-5">
      <span className="text-3xl">🛡️</span>
      <div className="flex-1">
        <h3 className="font-semibold text-gray-900">
          运营复审权限{' '}
          <span
            className={`ml-1 text-xs px-2 py-0.5 rounded-full ${
              enabled ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
            }`}
          >
            {enabled ? '已开启' : '已关闭'}
          </span>
        </h3>
        <p className="text-sm text-gray-600 mt-1">
          开启后，「运营」角色的账号可对待复审的老师进行复审（通过 / 驳回 / 永久拉黑），复审记录将署名运营姓名；学管角色不受影响。
        </p>
        {message && (
          <p className={`text-sm mt-2 ${message.startsWith('✅') ? 'text-green-600' : 'text-red-600'}`}>
            {message}
          </p>
        )}
      </div>
      <button
        onClick={toggle}
        disabled={pending}
        className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus:outline-none disabled:opacity-50 ${
          enabled ? 'bg-green-500' : 'bg-gray-300'
        }`}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
            enabled ? 'translate-x-6' : 'translate-x-1'
          }`}
        />
      </button>
    </div>
  )
}
