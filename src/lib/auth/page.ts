import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { getCurrentSession } from './session'
import { canAccessPath, ROLE_HOME } from './policy'

export async function requireWorkspacePage(fallback: string) {
  const destination = (await headers()).get('x-tutor-destination') || fallback
  const session = await getCurrentSession()
  if (!session) redirect(`/auth/login?redirect=${encodeURIComponent(destination)}`)
  if (!canAccessPath(session.activeRole, destination)) {
    if (session.roles.some(role => canAccessPath(role, destination))) redirect(`/auth/continue?redirect=${encodeURIComponent(destination)}`)
    redirect(ROLE_HOME[session.activeRole])
  }
  return session
}
