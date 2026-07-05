'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { resubmitDirectReferralAfterRejection } from '@/app/actions/referral'
import { resubmitCoachReview } from '@/app/actions/coachReview'

export default function ReferralRevisionResubmit({
  mode = 'referral',
}: {
  mode?: 'referral' | 'coachReview'
}) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleClick() {
    setError(null)
    setLoading(true)
    const result =
      mode === 'coachReview'
        ? await resubmitCoachReview()
        : await resubmitDirectReferralAfterRejection()
    setLoading(false)
    if (result.success) {
      router.refresh()
    } else {
      setError(result.error ?? null)
    }
  }

  return (
    <div className="mt-4">
      <button
        type="button"
        onClick={handleClick}
        disabled={loading}
        className="px-5 py-2.5 rounded-lg bg-red-700 text-white text-sm font-semibold hover:bg-red-800 disabled:opacity-60 transition-colors"
      >
        {loading ? '提交中…' : '修改完成，提交重新审核'}
      </button>
      {error && <p className="text-sm text-red-800 mt-2">{error}</p>}
    </div>
  )
}
