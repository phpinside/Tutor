'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { registerReferrer } from '@/app/actions/auth'

function RegisterForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  
  // 从URL获取ref参数或localStorage获取
  const [initialRefCode, setInitialRefCode] = useState('')
  
  useEffect(() => {
    // 优先从URL获取
    const refFromUrl = searchParams.get('ref')
    if (refFromUrl) {
      setInitialRefCode(refFromUrl)
      setFormData(prev => ({ ...prev, referralCode: refFromUrl }))
      return
    }
    
    // 否则从localStorage获取
    if (typeof window !== 'undefined') {
      const savedRef = localStorage.getItem('tutor_referral_code')
      if (savedRef) {
        setInitialRefCode(savedRef)
        setFormData(prev => ({ ...prev, referralCode: savedRef }))
      }
    }
  }, [searchParams])
  
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    password: '',
    confirmPassword: '',
    referralCode: ''
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [apiError, setApiError] = useState('')

  const validateForm = () => {
    const newErrors: Record<string, string> = {}

    if (!formData.name.trim()) {
      newErrors.name = '请输入姓名'
    }

    if (!formData.phone.trim()) {
      newErrors.phone = '请输入手机号'
    } else if (!/^1[3-9]\d{9}$/.test(formData.phone)) {
      newErrors.phone = '手机号格式不正确'
    }

    if (!formData.password) {
      newErrors.password = '请输入密码'
    } else if (formData.password.length < 6) {
      newErrors.password = '密码至少需要6位'
    }

    if (!formData.confirmPassword) {
      newErrors.confirmPassword = '请确认密码'
    } else if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = '两次密码输入不一致'
    }

    if (!formData.referralCode.trim()) {
      newErrors.referralCode = '请输入邀请码'
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
      const result = await registerReferrer(formData)

      if (result.success) {
        // 注册成功，跳转到新手引导
        router.push('/onboarding')
      } else {
        setApiError(result.error || '注册失败，请重试')
      }
    } catch (error) {
      console.error('注册错误:', error)
      setApiError('注册失败，请重试')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
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
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white py-12 px-4">
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
            用户注册
          </h1>
          <p className="text-gray-600">
              注册账号，开启伴学之旅
            </p>
        </div>

        {/* 注册表单 */}
        <div className="card">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* API错误提示 */}
            {apiError && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
                {apiError}
              </div>
            )}

            {/* 姓名 */}
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
                姓名 <span className="text-red-500">*</span>
              </label>
              <input
                id="name"
                type="text"
                value={formData.name}
                onChange={(e) => handleChange('name', e.target.value)}
                className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent ${
                  errors.name ? 'border-red-300' : 'border-gray-300'
                }`}
                placeholder="请输入真实姓名"
                disabled={isSubmitting}
              />
              {errors.name && (
                <p className="mt-1 text-sm text-red-600">{errors.name}</p>
              )}
            </div>

            {/* 手机号 */}
            <div>
              <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-2">
                手机号 <span className="text-red-500">*</span>
              </label>
              <input
                id="phone"
                type="tel"
                value={formData.phone}
                onChange={(e) => handleChange('phone', e.target.value)}
                className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent ${
                  errors.phone ? 'border-red-300' : 'border-gray-300'
                }`}
                placeholder="请输入手机号"
                maxLength={11}
                disabled={isSubmitting}
              />
              {errors.phone && (
                <p className="mt-1 text-sm text-red-600">{errors.phone}</p>
              )}
            </div>

            {/* 密码 */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                密码 <span className="text-red-500">*</span>
              </label>
              <input
                id="password"
                type="password"
                value={formData.password}
                onChange={(e) => handleChange('password', e.target.value)}
                className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent ${
                  errors.password ? 'border-red-300' : 'border-gray-300'
                }`}
                placeholder="请设置密码（至少6位）"
                disabled={isSubmitting}
              />
              {errors.password && (
                <p className="mt-1 text-sm text-red-600">{errors.password}</p>
              )}
            </div>

            {/* 确认密码 */}
            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-2">
                确认密码 <span className="text-red-500">*</span>
              </label>
              <input
                id="confirmPassword"
                type="password"
                value={formData.confirmPassword}
                onChange={(e) => handleChange('confirmPassword', e.target.value)}
                className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent ${
                  errors.confirmPassword ? 'border-red-300' : 'border-gray-300'
                }`}
                placeholder="请再次输入密码"
                disabled={isSubmitting}
              />
              {errors.confirmPassword && (
                <p className="mt-1 text-sm text-red-600">{errors.confirmPassword}</p>
              )}
            </div>

            {/* 邀请码 */}
            <div>
              <label htmlFor="referralCode" className="block text-sm font-medium text-gray-700 mb-2">
                邀请码 <span className="text-red-500">*</span>
              </label>
              <input
                id="referralCode"
                type="text"
                value={formData.referralCode}
                onChange={(e) => handleChange('referralCode', e.target.value.toUpperCase())}
                className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent ${
                  errors.referralCode ? 'border-red-300' : 'border-gray-300'
                }`}
                placeholder="请输入邀请码"
                disabled={isSubmitting}
              />
              {errors.referralCode && (
                <p className="mt-1 text-sm text-red-600">{errors.referralCode}</p>
              )}
              {initialRefCode && (
                <p className="mt-1 text-xs text-green-600">
                  ✓ 已自动填充邀请码
                </p>
              )}
            </div>

            {/* 提交按钮 */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-primary-600 hover:bg-primary-700 disabled:bg-gray-400 text-white font-medium py-3 px-6 rounded-lg transition-colors"
            >
              {isSubmitting ? '注册中...' : '注册'}
            </button>
          </form>

          {/* 登录链接 */}
          <div className="mt-6 text-center">
            <p className="text-sm text-gray-600">
              已有账号？
              <Link
                href="/auth/login"
                className="text-primary-600 hover:text-primary-700 font-medium ml-1"
              >
                立即登录
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function RegisterPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white py-12 px-4 flex items-center justify-center">
        <div className="text-gray-600">加载中...</div>
      </div>
    }>
      <RegisterForm />
    </Suspense>
  )
}
