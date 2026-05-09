'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { updateReferralStatus } from '@/app/actions/referral'
import ReferralRejectReasonModal from '@/components/admin/ReferralRejectReasonModal'

export type DirectReferralAuditSnapshot = {
  id: string
  status: 'PENDING' | 'VALID' | 'INVALID'
  adminNote: string | null
  rewardSent: boolean
  createdAtLabel: string
  reviewedAtLabel: string | null
}

export default function TeacherDirectReferralReview({
  directReferral,
}: {
  directReferral: DirectReferralAuditSnapshot | null
}) {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [rejectReferralId, setRejectReferralId] = useState<string | null>(null)

  const handleMarkValid = async (referralId: string) => {
    if (!confirm('确定要恢复为有效邀请吗？')) return

    setIsLoading(true)
    const result = await updateReferralStatus(referralId, 'VALID')
    setIsLoading(false)

    if (result.success) {
      router.refresh()
    } else {
      alert('操作失败：' + result.error)
    }
  }

  return (
    <div className="card mb-8">
      <ReferralRejectReasonModal
        open={rejectReferralId !== null}
        onClose={() => setRejectReferralId(null)}
        onConfirm={async (reason) => {
          const id = rejectReferralId
          if (!id) return false
          setIsLoading(true)
          const result = await updateReferralStatus(id, 'INVALID', reason)
          setIsLoading(false)
          if (result.success) {
            router.refresh()
            return true
          }
          alert('操作失败：' + result.error)
          return false
        }}
      />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between mb-4">
        <h2 className="text-xl font-bold text-gray-900">邀请审核</h2>
        {!directReferral ? (
          <span className="inline-flex items-center w-fit px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
            无记录
          </span>
        ) : directReferral.status === 'PENDING' ? (
          <span className="inline-flex items-center w-fit px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
            ⏳ 待审核
          </span>
        ) : directReferral.status === 'VALID' ? (
          <span className="inline-flex items-center w-fit px-2.5 py-0.5 rounded-full text-xs font-medium bg-success-100 text-success-800">
            ✅ 有效邀请
          </span>
        ) : (
          <span className="inline-flex items-center w-fit px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
            ❌ 审核不通过
          </span>
        )}
      </div>

      {!directReferral ? (
        <p className="text-sm text-gray-600">
          该老师当前没有作为被邀请人的直接邀请记录（无邀请审核流程或尚未建立对应记录）。
        </p>
      ) : (
        <>
          <div className="text-sm text-gray-600 space-y-1 mb-6">
            <p>
              <span className="text-gray-500">邀请时间：</span>
              {directReferral.createdAtLabel}
            </p>
            {directReferral.reviewedAtLabel && (
              <p>
                <span className="text-gray-500">审核时间：</span>
                {directReferral.reviewedAtLabel}
              </p>
            )}
            {directReferral.status === 'VALID' && (
              <p>
                <span className="text-gray-500">邀请人奖励：</span>
                {directReferral.rewardSent ? (
                  <span className="text-success-700 font-medium">已发放</span>
                ) : (
                  <span className="text-gray-800">待发放</span>
                )}
              </p>
            )}
          </div>

          {directReferral.status === 'INVALID' && directReferral.adminNote && (
            <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              <p className="font-medium text-amber-950 mb-1">不通过/无效理由</p>
              <p className="whitespace-pre-wrap">{directReferral.adminNote}</p>
            </div>
          )}

          {directReferral.status === 'PENDING' ? (
            <>
              <p className="text-sm text-gray-600 mb-6">
                可直接在此完成审核，结果与「邀请管理」中的操作一致。
              </p>
              <div className="flex flex-col sm:flex-row gap-8">
                <div className="flex-1 min-w-0">
                  <button
                    type="button"
                    onClick={() => handleMarkValid(directReferral.id)}
                    disabled={isLoading}
                    className="w-full sm:w-auto px-4 py-2 text-sm font-medium rounded-lg bg-success-100 text-success-700 hover:bg-success-200 disabled:opacity-50 transition-colors"
                  >
                    审核通过
                  </button>
                  <p className="mt-2 text-xs text-gray-500 leading-relaxed">
                    审核通过后，邀请人将获得10元奖励
                  </p>
                </div>
                <div className="flex-1 min-w-0">
                  <button
                    type="button"
                    onClick={() => setRejectReferralId(directReferral.id)}
                    disabled={isLoading}
                    className="w-full sm:w-auto px-4 py-2 text-sm font-medium rounded-lg bg-red-100 text-red-700 hover:bg-red-200 disabled:opacity-50 transition-colors"
                  >
                    审核不通过
                  </button>
                  <p className="mt-2 text-xs text-gray-500 leading-relaxed">
                    审核不通过后，教练可以在线重新完善个人资料，然后再次提交
                  </p>
                </div>
              </div>
            </>
          ) : (
            <div className="flex flex-wrap items-center gap-3">
              <Link
                href={`/admin/referrals/${directReferral.id}`}
                className="text-sm text-primary-600 hover:text-primary-700 font-medium"
              >
                查看邀请详情 →
              </Link>
              {directReferral.status === 'VALID' && (
                <button
                  type="button"
                  onClick={() => setRejectReferralId(directReferral.id)}
                  disabled={isLoading}
                  className="text-sm px-3 py-1.5 rounded-lg bg-red-100 text-red-700 hover:bg-red-200 disabled:opacity-50 transition-colors"
                >
                  标记无效
                </button>
              )}
              {directReferral.status === 'INVALID' && (
                <button
                  type="button"
                  onClick={() => handleMarkValid(directReferral.id)}
                  disabled={isLoading}
                  className="text-sm px-3 py-1.5 rounded-lg bg-success-100 text-success-700 hover:bg-success-200 disabled:opacity-50 transition-colors"
                >
                  恢复有效
                </button>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}
