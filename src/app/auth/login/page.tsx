import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { getCurrentSession } from '@/lib/auth/session'
import { chooseWorkspace } from '@/lib/auth/policy'
import LoginForm from './LoginForm'
export default async function LoginPage({ searchParams }: { searchParams: Promise<{ redirect?: string }> }) {
  const [session, params] = await Promise.all([getCurrentSession(), searchParams])
  if (session) {
    const workspace = chooseWorkspace(session.roles, session.activeRole, session.defaultRole, params.redirect)!
    if (workspace.role !== session.activeRole) redirect(`/auth/continue?redirect=${encodeURIComponent(workspace.destination)}`)
    redirect(workspace.destination)
  }
  return <Suspense fallback={<div className="p-12 text-center">加载中...</div>}><LoginForm /></Suspense>
}
