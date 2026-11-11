import { requireWorkspacePage } from '@/lib/auth/page'
import WorkspaceMenu from '@/components/auth/WorkspaceMenu'
import AdminLayoutClient from './AdminLayoutClient'
import OperatorLayoutClient from '@/app/operator/OperatorLayoutClient'
import { canManageWechatGroupQr } from '@/lib/wechatGroupQrAuth'
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await requireWorkspacePage('/admin/teachers')
  const accountMenu = <WorkspaceMenu />
  if (session.activeRole === 'LEARNER_MANAGER' || session.activeRole === 'OPERATOR') {
    return <OperatorLayoutClient operatorName={session.operatorName ?? session.name} accountMenu={accountMenu} canManageGroupQr={await canManageWechatGroupQr()}>{children}</OperatorLayoutClient>
  }
  return <AdminLayoutClient role="super_admin" accountMenu={accountMenu}>{children}</AdminLayoutClient>
}
