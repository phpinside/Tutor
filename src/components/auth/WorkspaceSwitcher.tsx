'use client'
import { useEffect, useId, useRef, useState } from 'react'
import Link from 'next/link'
import { ROLE_LABELS, type Role } from '@/lib/auth/policy'
export default function WorkspaceSwitcher({ name, roles, activeRole }: { name: string; roles: Role[]; activeRole: Role }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const panelId = useId()

  useEffect(() => {
    if (!open) return
    function dismissOutside(event: PointerEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false)
    }
    function dismissOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpen(false)
        triggerRef.current?.focus()
      }
    }
    document.addEventListener('pointerdown', dismissOutside)
    document.addEventListener('keydown', dismissOnEscape)
    return () => {
      document.removeEventListener('pointerdown', dismissOutside)
      document.removeEventListener('keydown', dismissOnEscape)
    }
  }, [open])
  async function switchTo(role: string) {
    setBusy(true); setError('')
    try {
      const response = await fetch('/api/auth/workspace', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role }),
      })
      const result = await response.json()
      if (response.ok && result.success && result.redirectTo) window.location.assign(result.redirectTo)
      else { setError(result.error || '切换失败'); setBusy(false) }
    } catch { setError('网络错误，请重试'); setBusy(false) }
  }
  async function logout() {
    setBusy(true); setError('')
    try {
      const response = await fetch('/api/auth/logout', { method: 'POST' })
      if (!response.ok) throw new Error()
      window.location.assign('/auth/login')
    } catch { setError('退出失败，请重试'); setBusy(false) }
  }
  const actionClass = 'flex min-h-10 w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 disabled:cursor-wait disabled:opacity-50'

  return (
    <div
      ref={containerRef}
      className="relative shrink-0 text-sm"
      onBlur={event => {
        if (!busy && !event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false)
      }}
    >
      <button
        ref={triggerRef}
        type="button"
        aria-label="账号菜单"
        aria-expanded={open}
        aria-controls={panelId}
        disabled={busy}
        onClick={() => setOpen(value => !value)}
        className={`inline-flex min-h-10 max-w-full items-center gap-2 rounded-lg border px-2.5 py-2 text-gray-700 transition-colors hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 disabled:opacity-50 sm:px-3 ${open ? 'border-primary-200 bg-primary-50' : 'border-gray-200 bg-white'}`}
      >
        <svg aria-hidden="true" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 shrink-0 text-gray-400"><path fillRule="evenodd" d="M10 2a4 4 0 100 8 4 4 0 000-8ZM3 17a7 7 0 1114 0H3Z" clipRule="evenodd" /></svg>
        <span className="max-w-20 truncate sm:max-w-32">{busy ? '处理中…' : name}</span>
        <svg aria-hidden="true" viewBox="0 0 20 20" fill="currentColor" className={`h-4 w-4 shrink-0 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`}><path fillRule="evenodd" d="M5.22 7.22a.75.75 0 011.06 0L10 10.94l3.72-3.72a.75.75 0 111.06 1.06l-4.25 4.25a.75.75 0 01-1.06 0L5.22 8.28a.75.75 0 010-1.06Z" clipRule="evenodd" /></svg>
      </button>

      {open && (
        <div id={panelId} className="absolute right-0 top-full z-50 mt-2 w-60 max-w-[calc(100vw-2rem)] rounded-xl border border-gray-200 bg-white p-2 shadow-lg" aria-label="账号操作">
          <div className="mb-1 border-b border-gray-100 px-3 py-2">
            <p className="break-words font-medium text-gray-900">{name}</p>
            <p className="mt-0.5 text-xs text-gray-500">{ROLE_LABELS[activeRole]}</p>
          </div>
          {roles.length > 1 && (
            <div className="mb-1 border-b border-gray-100 pb-1" aria-label="切换工作台">
              <p className="px-3 pb-1 pt-2 text-xs text-gray-400">切换工作台</p>
              {roles.map(role => (
                <button key={role} type="button" disabled={busy || role === activeRole} onClick={() => switchTo(role)} className={`${actionClass} ${role === activeRole ? 'bg-primary-50 text-primary-700 disabled:cursor-default disabled:opacity-100' : 'text-gray-700'}`}>
                  {ROLE_LABELS[role]}{role === activeRole && <span aria-label="当前工作台">✓</span>}
                </button>
              ))}
            </div>
          )}
          <Link href="/account" onClick={() => setOpen(false)} className={`${actionClass} text-gray-700`}>账号设置<span aria-hidden className="text-gray-400">→</span></Link>
          <button type="button" disabled={busy} onClick={logout} className={`${actionClass} text-red-600 hover:bg-red-50`}>退出登录</button>
          {error && <p role="alert" className="px-3 py-2 text-xs text-red-600">{error}</p>}
        </div>
      )}
    </div>
  )
}
