import { requireWorkspacePage } from '@/lib/auth/page'
import WorkspaceMenu from '@/components/auth/WorkspaceMenu'
import AccountSettings from './AccountSettings'
export default async function AccountPage() {
  const session = await requireWorkspacePage('/account')
  return <div className="min-h-screen bg-gray-50 p-4 sm:p-8"><div className="mx-auto max-w-xl space-y-6">
    <div className="flex justify-end"><WorkspaceMenu /></div>
    <h1 className="text-2xl font-bold">账号设置</h1>
    <p className="text-gray-600">登录账号：{session.login}</p>
    {!session.roles.includes('TEACHER') && /^1[3-9]\d{9}$/.test(session.login) && <a className="block text-blue-600" href={`/auth/register?phone=${encodeURIComponent(session.login)}&name=${encodeURIComponent(session.name)}`}>申请教练工作台 →</a>}
    <AccountSettings roles={session.roles} defaultRole={session.defaultRole} activeRole={session.activeRole} />
  </div></div>
}
