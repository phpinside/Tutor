import { getCurrentSession } from '@/lib/auth/session'
/** 角色与启用状态由统一数据库会话确认。 */
export async function isSuperAdmin(): Promise<boolean> {
  return (await getCurrentSession())?.activeRole === 'SUPER_ADMIN'
}
