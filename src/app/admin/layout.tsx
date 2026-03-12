import { cookies } from 'next/headers'
import AdminLayoutClient from './AdminLayoutClient'
import OperatorLayoutClient from '@/app/operator/OperatorLayoutClient'

async function getSessionInfo() {
  const cookieStore = await cookies()

  // 优先检测 operator_session（运营人员访问 /admin/teachers）
  const operatorSession = cookieStore.get('operator_session')
  if (operatorSession) {
    try {
      const data = JSON.parse(operatorSession.value)
      if (data.operatorId) {
        return { type: 'operator' as const, name: data.name as string }
      }
    } catch {}
  }

  // 否则读取管理员角色
  const adminSession = cookieStore.get('admin_session')
  if (adminSession) {
    try {
      const data = JSON.parse(adminSession.value)
      return { type: 'admin' as const, role: (data.role as string) || 'super_admin' }
    } catch {}
  }

  return { type: 'admin' as const, role: 'super_admin' }
}

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getSessionInfo()

  if (session.type === 'operator') {
    return (
      <OperatorLayoutClient operatorName={session.name}>
        {children}
      </OperatorLayoutClient>
    )
  }

  return <AdminLayoutClient role={session.role}>{children}</AdminLayoutClient>
}
