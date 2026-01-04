'use client'

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'

export default function ReferralEntryButton({ teacherId }: { teacherId: string }) {
  const searchParams = useSearchParams()
  
  // 如果 URL 中有 ref 参数，说明是通过邀请链接进入的新用户，隐藏邀请按钮
  const hasRefParam = searchParams.get('ref')
  if (hasRefParam) {
    return null
  }

  return (
    <Link
      href="/referral/dashboard"
      className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white rounded-lg transition-all font-medium shadow-md"
    >
      <span className="text-lg">🎁</span>
      <span className="text-sm">邀请有奖</span>
    </Link>
  )
}
