import { cookies } from 'next/headers'
import AdminLayoutClient from './AdminLayoutClient'

// 获取当前管理员角色
async function getAdminRole(): Promise<string> {
  const cookieStore = await cookies()
  const session = cookieStore.get('admin_session')
  
  if (!session) {
    return 'super_admin' // 默认返回超级管理员（理论上不会到这里，因为 middleware 会拦截）
  }
  
  try {
    const sessionData = JSON.parse(session.value)
    return sessionData.role || 'super_admin'
  } catch {
    return 'super_admin'
  }
}

export default async function AdminLayout({
  children
}: {
  children: React.ReactNode
}) {
  const role = await getAdminRole()
  
  return <AdminLayoutClient role={role}>{children}</AdminLayoutClient>
}

