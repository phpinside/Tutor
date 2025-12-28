'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

export default function LogoutButton() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)

  const handleLogout = async () => {
    if (!confirm('确定要退出登录吗？')) {
      return
    }

    setIsLoading(true)
    try {
      const response = await fetch('/api/admin/logout', {
        method: 'POST',
      })

      if (response.ok) {
        router.push('/admin/login')
        router.refresh()
      }
    } catch (error) {
      console.error('退出登录失败:', error)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <button
      onClick={handleLogout}
      disabled={isLoading}
      className="text-sm font-medium text-red-600 hover:text-red-700 disabled:opacity-50"
    >
      {isLoading ? '退出中...' : '退出登录'}
    </button>
  )
}


