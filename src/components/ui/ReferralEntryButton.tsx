'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

export default function ReferralEntryButton({ teacherId }: { teacherId: string }) {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)

  const handleClick = async () => {
    setIsLoading(true)
    try {
      // 调用生成邀请码的API并获取查看码
      const response = await fetch('/api/referral/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teacherId })
      })
      
      const result = await response.json()
      
      if (result.success && result.viewCode) {
        // 跳转到邀请看板
        router.push(`/referral/${result.viewCode}`)
      } else {
        alert('生成邀请码失败，请重试')
        setIsLoading(false)
      }
    } catch (error) {
      console.error('Error:', error)
      alert('操作失败，请重试')
      setIsLoading(false)
    }
  }

  return (
    <button
      onClick={handleClick}
      disabled={isLoading}
      className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white rounded-lg transition-all font-medium shadow-md disabled:opacity-50"
    >
      <span className="text-lg">🎁</span>
      <span className="text-sm">{isLoading ? '加载中...' : '邀请有奖'}</span>
    </button>
  )
}
