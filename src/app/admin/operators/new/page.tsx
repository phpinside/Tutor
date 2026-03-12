'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createOperator } from '@/app/actions/adminOperatorActions'
import Link from 'next/link'

export default function NewOperatorPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [isEnabled, setIsEnabled] = useState(true)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const form = e.currentTarget
    const data = {
      name: (form.elements.namedItem('name') as HTMLInputElement).value.trim(),
      phone: (form.elements.namedItem('phone') as HTMLInputElement).value.trim(),
      password: (form.elements.namedItem('password') as HTMLInputElement).value,
      isEnabled,
      remarks: (form.elements.namedItem('remarks') as HTMLTextAreaElement).value.trim() || undefined,
    }

    if (!data.name || !data.phone || !data.password) {
      setError('姓名、手机号和密码为必填项')
      setLoading(false)
      return
    }

    const result = await createOperator(data)
    if (result.success) {
      router.push('/admin/operators')
    } else {
      setError(result.error || '创建失败，请重试')
      setLoading(false)
    }
  }

  return (
    <div className="max-w-lg">
      <Link
        href="/admin/operators"
        className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6 transition-colors"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        返回列表
      </Link>

      <div className="card">
        <h1 className="text-xl font-bold text-gray-900 mb-6">新增运营人员</h1>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              姓名 <span className="text-red-500">*</span>
            </label>
            <input
              name="name"
              type="text"
              required
              className="input w-full"
              placeholder="请输入姓名"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              手机号 <span className="text-red-500">*</span>
            </label>
            <input
              name="phone"
              type="tel"
              required
              className="input w-full"
              placeholder="请输入手机号"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              初始密码 <span className="text-red-500">*</span>
            </label>
            <input
              name="password"
              type="password"
              required
              className="input w-full"
              placeholder="请设置初始密码"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">启用状态</label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  checked={isEnabled}
                  onChange={() => setIsEnabled(true)}
                  className="w-4 h-4 text-primary-600"
                />
                <span className="text-sm text-gray-700">启用</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  checked={!isEnabled}
                  onChange={() => setIsEnabled(false)}
                  className="w-4 h-4 text-primary-600"
                />
                <span className="text-sm text-gray-700">禁用（无法登录）</span>
              </label>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">备注</label>
            <textarea
              name="remarks"
              rows={3}
              className="input w-full resize-none"
              placeholder="可选备注信息"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={loading}
              className="btn-primary flex-1"
            >
              {loading ? '创建中...' : '创建运营人员'}
            </button>
            <Link href="/admin/operators" className="btn-secondary flex-1 text-center">
              取消
            </Link>
          </div>
        </form>
      </div>
    </div>
  )
}
