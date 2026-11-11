import { getCurrentSession } from '@/lib/auth/session'
import WorkspaceSwitcher from './WorkspaceSwitcher'
export default async function WorkspaceMenu() {
  const session = await getCurrentSession()
  if (!session) return null
  return <WorkspaceSwitcher name={session.name} roles={session.roles} activeRole={session.activeRole} />
}
