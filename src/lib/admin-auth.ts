import { cookies } from 'next/headers'

/** 校验 admin_session cookie 且角色为超级管理员；通过返回 true，否则 false。 */
export async function isSuperAdmin(): Promise<boolean> {
  const session = (await cookies()).get('admin_session')
  if (!session) return false
  try {
    const data = JSON.parse(session.value)
    return data.role === 'super_admin'
  } catch {
    return false
  }
}
