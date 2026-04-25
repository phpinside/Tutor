'use client'

import { useState } from 'react'
import { formatPhone } from '@/lib/utils'

type ViewerKind = 'operator' | 'admin'

interface Props {
  teacherId: string
  phone: string | null
  viewerKind: ViewerKind
  canReveal: boolean
}

export default function TeacherPhoneRevealControl({
  teacherId,
  phone,
  viewerKind,
  canReveal,
}: Props) {
  const [isOpen, setIsOpen] = useState(false)
  const [password, setPassword] = useState('')
  const [username, setUsername] = useState('admin')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [revealed, setRevealed] = useState<string | null>(null)
  const [copyHint, setCopyHint] = useState('')

  if (!phone) {
    return (
      <p className="font-medium text-gray-900" aria-label="联系电话未填写">
        未填写
      </p>
    )
  }

  const masked = formatPhone(phone)

  const open = () => {
    if (!canReveal) return
    setPassword('')
    setUsername('admin')
    setError('')
    setRevealed(null)
    setCopyHint('')
    setIsOpen(true)
  }

  const close = () => {
    if (loading) return
    setIsOpen(false)
    setPassword('')
    setError('')
    setRevealed(null)
    setCopyHint('')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (viewerKind === 'admin' && !username.trim()) {
      setError('请输入用户名')
      return
    }
    if (!password) {
      setError('请输入密码')
      return
    }
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/admin/teachers/reveal-phone', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          teacherId,
          password,
          ...(viewerKind === 'admin' ? { username: username.trim() } : {}),
        }),
      })
      const data = await res.json().catch(() => ({}))
      setLoading(false)
      if (res.ok && typeof data.phone === 'string') {
        setRevealed(data.phone)
        return
      }
      setError(typeof data.error === 'string' ? data.error : '验证失败，请重试')
    } catch {
      setLoading(false)
      setError('网络错误，请重试')
    }
  }

  const copyRevealed = async () => {
    if (!revealed) return
    try {
      await navigator.clipboard.writeText(revealed)
      setCopyHint('已复制')
      setTimeout(() => setCopyHint(''), 2000)
    } catch {
      setCopyHint('复制失败')
      setTimeout(() => setCopyHint(''), 2000)
    }
  }

  const label = '点击查看完整号码（需验证本人账号）'

  return (
    <>
      {canReveal ? (
        <button
          type="button"
          onClick={open}
          className="font-medium text-left text-indigo-700 hover:text-indigo-900 hover:underline decoration-indigo-300 underline-offset-2"
          aria-label={label}
        >
          {masked}
        </button>
      ) : (
        <p className="font-medium text-gray-900">{masked}</p>
      )}

      {isOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div
            className="bg-white rounded-2xl shadow-xl w-full max-w-sm"
            role="dialog"
            aria-modal="true"
            aria-labelledby="reveal-phone-title"
          >
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <h3 id="reveal-phone-title" className="text-base font-bold text-gray-900">
                {revealed ? '完整手机号' : '验证身份'}
              </h3>
              <button
                type="button"
                onClick={close}
                className="text-gray-400 hover:text-gray-600"
                disabled={loading}
              >
                ✕
              </button>
            </div>
            <div className="p-5 space-y-4">
              {revealed ? (
                <div className="space-y-3">
                  <p className="text-2xl font-mono font-semibold text-gray-900 tracking-wide break-all">
                    {revealed || '（无）'}
                  </p>
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={copyRevealed}
                      className="px-4 py-2 border border-gray-300 text-gray-800 rounded-lg hover:bg-gray-50 text-sm font-medium"
                    >
                      复制{copyHint ? ` · ${copyHint}` : ''}
                    </button>
                    <button
                      type="button"
                      onClick={close}
                      className="px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 text-sm font-medium"
                    >
                      关闭
                    </button>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                  <p className="text-sm text-gray-600">
                    请输入{viewerKind === 'admin' ? '后台' : '运营'}登录密码以查看该老师的完整手机号。
                  </p>
                  {viewerKind === 'admin' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">用户名</label>
                      <input
                        type="text"
                        value={username}
                        onChange={e => {
                          setUsername(e.target.value)
                          setError('')
                        }}
                        className="input w-full"
                        autoComplete="username"
                        autoFocus
                      />
                    </div>
                  )}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">密码</label>
                    <input
                      type="password"
                      value={password}
                      onChange={e => {
                        setPassword(e.target.value)
                        setError('')
                      }}
                      className="input w-full"
                      autoComplete="current-password"
                      autoFocus={viewerKind === 'operator'}
                    />
                  </div>
                  {error && <p className="text-sm text-red-500">{error}</p>}
                  <div className="flex gap-3 pt-1">
                    <button
                      type="button"
                      onClick={close}
                      disabled={loading}
                      className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 text-sm font-medium disabled:opacity-50"
                    >
                      取消
                    </button>
                    <button
                      type="submit"
                      disabled={loading}
                      className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-medium disabled:opacity-50"
                    >
                      {loading ? '验证中...' : '确认'}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
