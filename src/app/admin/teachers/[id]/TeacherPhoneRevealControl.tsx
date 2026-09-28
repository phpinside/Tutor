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

/**
 * 手机号揭示控件：点击「揭示」按钮即可查看完整号码（无需再次登录验证），
 * 每次揭示由服务端记录审计日志（谁/何时/看了哪位教练）。
 */
export default function TeacherPhoneRevealControl({
  teacherId,
  phone,
  canReveal,
}: Props) {
  const [revealed, setRevealed] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [copyHint, setCopyHint] = useState('')

  if (!phone) {
    return (
      <p className="font-medium text-gray-900" aria-label="联系电话未填写">
        未填写
      </p>
    )
  }

  const masked = formatPhone(phone)

  const reveal = async () => {
    if (loading) return
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/admin/teachers/reveal-phone', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ teacherId }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok && typeof data.phone === 'string') {
        setRevealed(data.phone)
      } else {
        setError(typeof data.error === 'string' ? data.error : '揭示失败，请重试')
      }
    } catch {
      setError('网络错误，请重试')
    } finally {
      setLoading(false)
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

  if (!canReveal) {
    return <p className="font-medium text-gray-900">{masked}</p>
  }

  return (
    <div>
      {revealed ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-lg font-mono font-semibold text-gray-900 tracking-wide">
            {revealed}
          </span>
          <button
            type="button"
            onClick={copyRevealed}
            className="text-xs px-2 py-0.5 border border-gray-300 text-gray-700 rounded hover:bg-gray-50"
          >
            复制{copyHint ? ` · ${copyHint}` : ''}
          </button>
          <button
            type="button"
            onClick={() => setRevealed(null)}
            className="text-xs text-gray-400 hover:text-gray-600 underline"
          >
            隐藏
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={reveal}
          disabled={loading}
          className="font-medium text-left text-indigo-700 hover:text-indigo-900 hover:underline decoration-indigo-300 underline-offset-2 disabled:opacity-60"
          aria-label="点击揭示完整手机号"
        >
          {loading ? '获取中…' : masked}
        </button>
      )}
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  )
}
