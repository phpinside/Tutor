'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import PasswordInput from '@/components/ui/PasswordInput'
import LoadingSpinner from '@/components/ui/LoadingSpinner'

export default function CompleteInfoPage() {
  const router = useRouter()
  
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    // 前端验证
    if (!name.trim()) {
      setError('请输入姓名')
      return
    }

    if (!/^1[3-9]\d{9}$/.test(phone)) {
      setError('手机号格式不正确')
      return
    }

    if (password.length < 6) {
      setError('密码至少需要6位')
      return
    }

    if (password !== confirmPassword) {
      setError('两次密码输入不一致')
      return
    }

    setIsLoading(true)

    try {
      // 调用补充信息 API
      const response = await fetch('/api/auth/complete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name,
          phone,
          password,
          confirmPassword
        }),
      })

      const result = await response.json()

      if (result.success) {
        // 补充成功，跳转到引导页
        router.push('/onboarding')
      } else {
        setError(result.error || '保存失败')
      }
    } catch (err) {
      setError('保存失败，请重试')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-900 mb-3 text-center">
        完善账号信息
      </h2>
      
      <p className="text-sm text-gray-600 mb-6 text-center">
        为了保障账号安全，请设置手机号和密码
      </p>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* 姓名 */}
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
            姓名 <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="请输入真实姓名"
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
            required
            disabled={isLoading}
          />
        </div>

        {/* 手机号 */}
        <div>
          <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-2">
            手机号 <span className="text-red-500">*</span>
          </label>
          <input
            type="tel"
            id="phone"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="请输入手机号"
            maxLength={11}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
            required
            disabled={isLoading}
          />
        </div>

        {/* 密码 */}
        <div>
          <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
            密码 <span className="text-red-500">*</span>
          </label>
          <PasswordInput
            value={password}
            onChange={setPassword}
            placeholder="请输入密码（至少6位）"
            name="password"
            autoComplete="new-password"
            required
          />
        </div>

        {/* 确认密码 */}
        <div>
          <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-2">
            确认密码 <span className="text-red-500">*</span>
          </label>
          <PasswordInput
            value={confirmPassword}
            onChange={setConfirmPassword}
            placeholder="请再次输入密码"
            name="confirmPassword"
            autoComplete="new-password"
            required
          />
        </div>

        {/* 提交按钮 */}
        <button
          type="submit"
          disabled={isLoading}
          className="w-full py-3 bg-primary-600 hover:bg-primary-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {isLoading ? (
            <>
              <LoadingSpinner size="sm" />
              <span>保存中...</span>
            </>
          ) : (
            '保存并继续'
          )}
        </button>
      </form>

      <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <p className="text-sm text-blue-800">
          💡 <strong>温馨提示：</strong>手机号将用于后续登录，请确保准确无误
        </p>
      </div>
    </div>
  )
}
