'use client'
import { useState } from 'react'
import Link from 'next/link'
import { setDefaultWorkspace, updateOwnPassword } from '@/app/actions/auth'
import { ROLE_HOME, ROLE_LABELS, type Role } from '@/lib/auth/policy'
export default function AccountSettings({ roles, defaultRole, activeRole }: { roles: Role[]; defaultRole: Role; activeRole: Role }) {
  const [busy, setBusy] = useState(false), [message, setMessage] = useState('')
  const [selected, setSelected] = useState<Role>(roles.includes(defaultRole) ? defaultRole : activeRole)
  async function saveDefault() {
    setBusy(true)
    try { const result = await setDefaultWorkspace(selected); setMessage(result.success ? '默认工作台已保存' : result.error || '保存失败') }
    catch { setMessage('保存失败，请重试') } finally { setBusy(false) }
  }
  async function changePassword(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = new FormData(event.currentTarget)
    if (form.get('newPassword') !== form.get('confirmPassword')) { setMessage('两次新密码不一致'); return }
    setBusy(true)
    try {
      const result = await updateOwnPassword(String(form.get('oldPassword')), String(form.get('newPassword')))
      if (result.success) window.location.assign('/auth/login?passwordChanged=1')
      else setMessage(result.error || '修改失败')
    } catch { setMessage('修改失败，请重试') } finally { setBusy(false) }
  }
  return <>
    <Link href={ROLE_HOME[activeRole]} className="inline-block text-blue-600">← 返回工作台</Link>
    {message && <p role="status" className="rounded bg-blue-50 p-3 text-sm">{message}</p>}
    {roles.length > 1 && <div className="card space-y-3"><label htmlFor="default-role" className="block font-medium">首次登录默认工作台</label><select id="default-role" value={selected} disabled={busy} onChange={e => setSelected(e.target.value as Role)} className="input w-full">{roles.map(role => <option key={role} value={role}>{ROLE_LABELS[role]}</option>)}</select><p className="text-sm text-gray-500">日常登录优先进入上次使用的工作台；该设置用于没有使用记录时。</p><button onClick={saveDefault} disabled={busy} className="btn-primary">保存</button></div>}
    <form onSubmit={changePassword} className="card space-y-4"><h2 className="font-semibold">修改登录密码</h2><p className="text-sm text-gray-500">修改后所有设备会退出，请使用新密码重新登录。</p>
      {([['oldPassword', '原密码', 'current-password'], ['newPassword', '新密码', 'new-password'], ['confirmPassword', '确认新密码', 'new-password']] as const).map(([id, label, autoComplete]) => <label key={id} className="block text-sm">{label}<input name={id} type="password" autoComplete={autoComplete} minLength={id === 'oldPassword' ? undefined : 6} maxLength={72} required disabled={busy} className="input mt-1 w-full" /></label>)}
      <button disabled={busy} className="btn-primary">修改密码</button>
    </form>
  </>
}
