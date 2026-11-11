'use client'
import { useState } from 'react'
import Link from 'next/link'
import { switchWorkspace } from '@/app/actions/auth'
import { ROLE_LABELS, type Role } from '@/lib/auth/policy'
export default function WorkspaceSwitcher({ name, roles, activeRole }: { name: string; roles: Role[]; activeRole: Role }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  async function switchTo(role: string) {
    setBusy(true); setError('')
    try {
      const result = await switchWorkspace(role)
      if (result.success && result.redirectTo) window.location.assign(result.redirectTo)
      else { setError(result.error || '切换失败'); setBusy(false) }
    } catch { setError('网络错误，请重试'); setBusy(false) }
  }
  async function logout() {
    setBusy(true)
    try {
      const response = await fetch('/api/auth/logout', { method: 'POST' })
      if (!response.ok) throw new Error()
      window.location.assign('/auth/login')
    } catch { setError('退出失败，请重试'); setBusy(false) }
  }
  return <div className="flex shrink-0 flex-wrap items-center gap-3 text-sm" aria-label="账号菜单">
    <span className="text-gray-600">{name}</span>
    {roles.length > 1 && <select aria-label="切换工作台" disabled={busy} value={activeRole} onChange={e => switchTo(e.target.value)} className="rounded border border-gray-200 bg-white px-2 py-1">{roles.map(role => <option key={role} value={role}>{ROLE_LABELS[role]}</option>)}</select>}
    <Link href="/account" className="text-gray-600 hover:text-blue-600">账号设置</Link>
    <button disabled={busy} onClick={logout} className="text-red-600 disabled:opacity-50">退出</button>
    {error && <span role="alert" className="text-red-600">{error}</span>}
  </div>
}
