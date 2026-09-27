'use server'

import { prisma } from '@/lib/prisma'
import { isSuperAdmin } from '@/lib/admin-auth'

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
