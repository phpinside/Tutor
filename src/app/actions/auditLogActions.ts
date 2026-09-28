'use server'

import { prisma } from '@/lib/prisma'
import { isSuperAdmin } from '@/lib/admin-auth'
import { getOperatorSessionInfo } from '@/lib/operatorAuth'
import { isTeacherInScope } from '@/lib/learnerManagerScope'

export type AuditLogItem = {
  id: string
  actorType: string
  actorId: string
  actorName: string | null
  action: string
  targetType: string | null
  targetId: string | null
  detail: unknown
  createdAt: Date
}

export async function getAuditLogs(
  page: number = 1,
  pageSize: number = 50,
  actionFilter?: string
): Promise<{
  success: boolean
  logs?: AuditLogItem[]
  total?: number
  totalPages?: number
  error?: string
}> {
  if (!(await isSuperAdmin())) {
    return { success: false, error: '仅超级管理员可查看审计日志' }
  }

  try {
    const where = actionFilter ? { action: { contains: actionFilter } } : {}
    const total = await prisma.auditLog.count({ where })
    const logs = await prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    })

    return {
      success: true,
      logs,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    }
  } catch (error) {
    console.error('获取审计日志失败:', error)
    return { success: false, error: '获取审计日志失败' }
  }
}

/**
 * 老师修改日志：该老师名下的全部审计记录（谁/何时/改了什么）。
 * 可见性与详情页一致：超管 / 教师本人 / 白名单内运营。
 */
export async function getTeacherChangeLogs(
  teacherId: string,
  limit: number = 30
): Promise<{ success: boolean; logs?: unknown[]; error?: string }> {
  let allowed = await isSuperAdmin()

  // 仅学管 / 运营 / 超管可查看；老师本人不开放（防止自查敏感操作痕迹）
  if (!allowed) {
    const session = await getOperatorSessionInfo()
    if (session) {
      const inScope = await isTeacherInScope(session.operatorId, teacherId)
      allowed = inScope !== false
    }
  }

  if (!allowed) {
    return { success: false, logs: [], error: '无权限查看修改日志' }
  }

  const logs = await prisma.auditLog.findMany({
    where: { targetType: 'TEACHER', targetId: teacherId },
    orderBy: { createdAt: 'desc' },
    take: limit,
  })

  return { success: true, logs }
}