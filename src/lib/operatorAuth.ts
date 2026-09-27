import { cookies } from 'next/headers'
import { prisma } from '@/lib/prisma'

export type OperatorSessionInfo = {
  operatorId: string
  name: string
  role: string // cookie 内快照，可能为旧会话的 'operator'；鉴权以 DB 为准
}

export async function isSuperAdminRequest(): Promise<boolean> {
  const cookieStore = await cookies()
  const session = cookieStore.get('admin_session')
  if (!session) return false
  try {
    const data = JSON.parse(session.value)
    return data.role === 'super_admin'
  } catch {
    return false
  }
}

/**
 * 读取运营（学管）会话；无 cookie 或解析失败返回 null。
 * 注意：cookie 中的 role 仅为登录时快照，敏感操作请以 DB 中的 Operator.role 为准。
 */
export async function getOperatorSessionInfo(): Promise<OperatorSessionInfo | null> {
  const cookieStore = await cookies()
  const session = cookieStore.get('operator_session')
  if (!session) return null
  try {
    const data = JSON.parse(session.value)
    if (!data.operatorId) return null
    return {
      operatorId: data.operatorId as string,
      name: (data.name as string) || '学管',
      role: (data.role as string) || 'operator',
    }
  } catch {
    return null
  }
}

/**
 * 请求级学管鉴权：读 cookie 会话后再查 DB 确认 isEnabled + role。
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
