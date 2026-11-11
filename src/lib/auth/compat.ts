import { cookies as nextCookies } from 'next/headers'
import { getCurrentSession } from './session'

/**
 * 迁移适配层：旧业务只读取由数据库会话派生的身份，绝不信任客户端旧身份 Cookie。
 * 本模块只兼容读取；所有会话写入/撤销集中在 session.ts。
 */
export async function cookies() {
  const [store, session] = await Promise.all([nextCookies(), getCurrentSession()])
  const identities: Record<string, string | undefined> = {
    teacherId: session?.activeRole === 'TEACHER' ? session.teacherId ?? undefined : undefined,
    admin_session: session?.activeRole === 'SUPER_ADMIN' ? JSON.stringify({ authenticated: true, role: 'super_admin', accountId: session.accountId }) : undefined,
    operator_session: session && ['LEARNER_MANAGER', 'OPERATOR'].includes(session.activeRole) && session.operatorId
      ? JSON.stringify({ operatorId: session.operatorId, name: session.operatorName, role: session.activeRole }) : undefined,
  }
  return {
    get(name: string) {
      if (Object.hasOwn(identities, name)) return identities[name] ? { name, value: identities[name]! } : undefined
      return store.get(name)
    },
  }
}
