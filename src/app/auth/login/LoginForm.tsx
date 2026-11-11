'use client'

import { useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { login } from '@/app/actions/auth'
import { PERMANENTLY_REJECTED_MESSAGE } from '@/lib/coachReviewShared'

export default function LoginForm() {
  const searchParams = useSearchParams()
  const redirect = searchParams.get('redirect')
  const wasRejected = searchParams.get('rejected') === '1'
  
  const [formData, setFormData] = useState({
    identifier: '',
    password: '',
    linkedPassword: ''
  })
  const [requiresLink, setRequiresLink] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [apiError, setApiError] = useState(wasRejected ? PERMANENTLY_REJECTED_MESSAGE : '')

  const validateForm = () => {
    const newErrors: Record<string, string> = {}

    if (!formData.identifier.trim()) newErrors.identifier = '请输入手机号或账号'

    if (!formData.password) {
      newErrors.password = '请输入密码'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setApiError('')

    if (!validateForm()) {
      return
    }

    setIsSubmitting(true)

    try {
      const result = await login({ identifier: formData.identifier.trim(), password: formData.password, linkedPassword: requiresLink ? formData.linkedPassword : undefined, redirect })

      if (result.success) {
        // 登录成功，跳转到指定页面
        window.location.assign(result.redirectTo || '/auth/login')
      } else {
        setRequiresLink(Boolean(result.requiresLink))
        setApiError(result.error || '登录失败，请重试')
      }
    } catch (error) {
      console.error('登录错误:', error)
      setApiError('登录失败，请重试')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value, ...((field === 'identifier' || field === 'password') ? { linkedPassword: '' } : {}) }))
    if (field === 'identifier' || field === 'password') setRequiresLink(false)
    // 清除该字段的错误
    if (errors[field]) {
      setErrors(prev => {
        const newErrors = { ...prev }
        delete newErrors[field]
        return newErrors
      })
    }
    setApiError('')
  }

  return (
    <div className="px-4 py-8">
      <div className="max-w-md mx-auto">
        {/* 返回首页 */}
        <div className="mb-6">
          <Link
            href="/"
            className="inline-flex items-center text-primary-600 hover:text-primary-700"
          >
            ← 返回首页
          </Link>
        </div>

        {/* 页面标题 */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            欢迎使用伴学平台
          </h1>
          <p className="text-gray-600">
            登录后继续你的工作
          </p>
        </div>

        {searchParams.get('passwordChanged') === '1' && <p role="status" className="mb-4 rounded-lg bg-green-50 p-3 text-sm text-green-700">密码已修改，请重新登录</p>}
        {/* 登录表单 */}
        <div className="card">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* API错误提示 */}
            {apiError && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
                {apiError}
              </div>
            )}

            {/* 手机号 */}
            <div>
              <label htmlFor="identifier" className="block text-sm font-medium text-gray-700 mb-2">
                账号
              </label>
              <input
                id="identifier"
                type="text"
                value={formData.identifier}
                onChange={(e) => handleChange('identifier', e.target.value)}
                className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent ${
                  errors.identifier ? 'border-red-300' : 'border-gray-300'
                }`}
                placeholder="请输入手机号或账号"
                maxLength={100}
                autoComplete="username"
                disabled={isSubmitting}
              />
              {errors.identifier && (
                <p className="mt-1 text-sm text-red-600">{errors.identifier}</p>
              )}
            </div>

            {/* 密码 */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                密码
              </label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                maxLength={72}
                value={formData.password}
                onChange={(e) => handleChange('password', e.target.value)}
                className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent ${
                  errors.password ? 'border-red-300' : 'border-gray-300'
                }`}
                placeholder="请输入密码"
                disabled={isSubmitting}
              />
              {errors.password && (
                <p className="mt-1 text-sm text-red-600">{errors.password}</p>
              )}
            </div>

            {requiresLink && (
              <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 space-y-2">
                <label htmlFor="linkedPassword" className="block text-sm font-medium text-gray-800">另一套原密码</label>
                <p className="text-xs text-gray-600">验证后关联已有账号，之后统一使用上方登录密码。无法验证时请联系管理员核验。</p>
                <input id="linkedPassword" type="password" autoComplete="off" maxLength={72} required disabled={isSubmitting} value={formData.linkedPassword} onChange={e => handleChange('linkedPassword', e.target.value)} className="input w-full" />
              </div>
            )}

            {/* 提交按钮 */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-primary-600 hover:bg-primary-700 disabled:bg-gray-400 text-white font-medium py-3 px-6 rounded-lg transition-colors"
            >
              {isSubmitting ? '登录中...' : '登录'}
            </button>
          </form>

          <div className="mt-4 text-right"><Link href="/auth/help" className="text-sm text-gray-500 hover:text-primary-600">忘记密码？</Link></div>
          {/* 注册链接 */}
          <div className="mt-6 text-center">
            <p className="text-sm text-gray-600">
              还没有账号？
              <Link
                href="/auth/register"
                className="text-primary-600 hover:text-primary-700 font-medium ml-1"
              >
                立即注册
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

