'use server'

import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import { isSuperAdmin } from '@/lib/admin-auth'
import { recordAudit } from '@/lib/auditLog'
import { LEARNER_MANAGER_SCOPE_KEY } from '@/lib/learnerManagerScope'

export type ScopeSettings = {
  enabledOperatorIds: string[] // [] = 关闭；['*'] = 全量；[operatorId...] = 灰度
  operators: { id: string; name: string; phone: string; isEnabled: boolean }[]
}

export async function getScopeSettings(): Promise<
  { success: true; data: ScopeSettings } | { success: false; error: string }
> {
  if (!(await isSuperAdmin())) {
    return { success: false, error: '仅超级管理员可查看学管数据范围配置' }
  }

  const config = await prisma.systemConfig.findUnique({
    where: { key: LEARNER_MANAGER_SCOPE_KEY },
  })

  let enabledOperatorIds: string[] = []
  if (config?.value) {
    try {
      const parsed = JSON.parse(config.value)
      if (Array.isArray(parsed)) {
        enabledOperatorIds = parsed.filter((item): item is string => typeof item === 'string')
      }
    } catch {
      enabledOperatorIds = []
    }
  }

  const operators = await prisma.operator.findMany({
    orderBy: [{ isEnabled: 'desc' }, { createdAt: 'asc' }],
    select: { id: true, name: true, phone: true, isEnabled: true },
  })

  return { success: true, data: { enabledOperatorIds, operators } }
}

export async function updateScopeSettings(
  value: string[]
): Promise<{ success: boolean; error?: string }> {
  if (!(await isSuperAdmin())) {
    return { success: false, error: '仅超级管理员可修改学管数据范围配置' }
  }

  // 合法性校验：去重；'*' 只能单独出现
  const cleaned = Array.from(new Set(value.filter((v) => typeof v === 'string' && v.trim() !== '')))
  if (cleaned.includes('*') && cleaned.length > 1) {
    return { success: false, error: '"*"（全量启用）不能与具体学管 ID 同时配置' }
  }
  if (cleaned.length > 0 && !cleaned.includes('*')) {
    const count = await prisma.operator.count({ where: { id: { in: cleaned } } })
    if (count !== cleaned.filter((v) => v !== '*').length) {
      return { success: false, error: '配置中包含不存在的学管 ID' }
    }
  }

  const previous = await prisma.systemConfig.findUnique({
    where: { key: LEARNER_MANAGER_SCOPE_KEY },
  })
  const nextValue = JSON.stringify(cleaned)

  await prisma.systemConfig.upsert({
    where: { key: LEARNER_MANAGER_SCOPE_KEY },
    update: { value: nextValue },
    create: { key: LEARNER_MANAGER_SCOPE_KEY, value: nextValue },
  })

  await recordAudit({
    actorType: 'ADMIN',
    actorId: 'super_admin',
    actorName: '管理员',
    action: 'SCOPE_CONFIG_CHANGE',
    targetType: 'SYSTEM_CONFIG',
    targetId: LEARNER_MANAGER_SCOPE_KEY,
    detail: { from: previous?.value ?? null, to: nextValue },
  })

  revalidatePath('/admin/config')
  return { success: true }
}
