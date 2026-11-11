import { prisma } from '@/lib/prisma'
import { getCurrentSession } from '@/lib/auth/session'
export type OperatorSessionInfo = { operatorId: string; name: string; role: string }
export async function isSuperAdminRequest(): Promise<boolean> {
  return (await getCurrentSession())?.activeRole === 'SUPER_ADMIN'
}
/** 会话、角色授权与业务启用状态均已由服务端数据库验证。 */
export async function getOperatorSessionInfo(): Promise<OperatorSessionInfo | null> {
  const session = await getCurrentSession()
  if (!session || !['LEARNER_MANAGER', 'OPERATOR'].includes(session.activeRole) || !session.operatorId) return null
  return { operatorId: session.operatorId, name: session.operatorName || session.name, role: session.activeRole }
}

/**
 * 请求级学管鉴权：验证统一会话后再查 DB 确认 isEnabled + role。
 * 返回 null 表示当前请求不是有效的启用状态学管。
 */
export async function requireLearnerManager(): Promise<{
  operatorId: string
  name: string
} | null> {
  const session = await getOperatorSessionInfo()
  if (!session) return null
  try {
    const operator = await prisma.operator.findUnique({
      where: { id: session.operatorId },
      select: { isEnabled: true, role: true },
    })
    if (!operator || !operator.isEnabled || operator.role !== 'LEARNER_MANAGER') {
      return null
    }
    return { operatorId: session.operatorId, name: session.name }
  } catch {
    return null
  }
}
