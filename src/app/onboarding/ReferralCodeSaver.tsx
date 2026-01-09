'use client'

import { useEffect } from 'react'

/**
 * 客户端组件：保存邀请码到 localStorage
 * 用于后续注册邀请人时自动填充
 */
export default function ReferralCodeSaver({ refCode }: { refCode: string }) {
  useEffect(() => {
    if (refCode && typeof window !== 'undefined') {
      localStorage.setItem('tutor_referral_code', refCode)
    }
  }, [refCode])

  return null // 不渲染任何内容
}
