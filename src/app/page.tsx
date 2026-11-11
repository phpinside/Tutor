import { redirect } from 'next/navigation'
import { getCurrentSession } from '@/lib/auth/session'
import { ROLE_HOME } from '@/lib/auth/policy'
export default async function HomePage({ searchParams }: { searchParams: Promise<{ ref?: string }> }) {
  const [params, session] = await Promise.all([searchParams, getCurrentSession()])
  if (!session) redirect(params.ref ? `/auth/register?ref=${encodeURIComponent(params.ref)}` : '/auth/login')
  if (params.ref && session.activeRole === 'TEACHER') redirect(`/api/init?ref=${encodeURIComponent(params.ref)}`)
  redirect(ROLE_HOME[session.activeRole])
}
