import { requireWorkspacePage } from '@/lib/auth/page'
import WorkspaceMenu from '@/components/auth/WorkspaceMenu'
export default async function Layout({ children }: { children: React.ReactNode }) {
  await requireWorkspacePage('/referral/dashboard')
  return <><div className="flex justify-end bg-white border-b px-4 py-3"><WorkspaceMenu /></div>{children}</>
}
