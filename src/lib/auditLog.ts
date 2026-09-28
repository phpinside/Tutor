import { prisma } from '@/lib/prisma'

export type AuditEntry = {
  actorType: 'OPERATOR' | 'ADMIN' | 'TEACHER' | 'SYSTEM'
  actorId: string
  actorName?: string | null
  action: string
  targetType?: string
  targetId?: string
  detail?: Record<string, unknown>
}

/**
 * 记录敏感操作审计日志。
 * 审计失败绝不影响业务主流程，仅打印错误。
 */
export async function recordAudit(entry: AuditEntry): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        actorType: entry.actorType,
        actorId: entry.actorId,
        actorName: entry.actorName ?? null,
        action: entry.action,
        targetType: entry.targetType ?? null,
        targetId: entry.targetId ?? null,
        detail: (entry.detail ?? undefined) as never,
      },
    })
  } catch (error) {
    console.error('写入审计日志失败:', error)
  }
}
