import { requireWorkspacePage } from '@/lib/auth/page'
import WorkspaceMenu from '@/components/auth/WorkspaceMenu'
import OperatorLayoutClient from '../OperatorLayoutClient'
import { canManageWechatGroupQr } from '@/lib/wechatGroupQrAuth'
export default async function OperatorDashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await requireWorkspacePage('/operator/team')
  return <OperatorLayoutClient operatorName={session.operatorName ?? session.name} accountMenu={<WorkspaceMenu />} canManageGroupQr={await canManageWechatGroupQr()}>{children}</OperatorLayoutClient>
}
