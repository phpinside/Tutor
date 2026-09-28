'use server'

import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import { isSuperAdmin } from '@/lib/admin-auth'
import { recordAudit } from '@/lib/auditLog'

const CONFIG_KEY = 'COACH_REVIEW_FALLBACK_POOL'
const DEFAULT_WEIGHT = 1
const OPERATOR_FINAL_REVIEW_KEY = 'OPERATOR_FINAL_REVIEW_ENABLED'

export type PoolOperator = {
  id: string
  name: string
  phone: string
  role: string
  weight: number
  isEnabled: boolean
}

export async function getCoachReviewPoolConfig(): Promise<{
  success: boolean
  operators?: PoolOperator[]
  error?: string
}> {
  try {
    // 含运营手机号，仅超管可读
    if (!(await isSuperAdmin())) {
      return { success: false, error: '仅超级管理员可查看分配池配置' }
    }
    const operators = await prisma.operator.findMany({
      orderBy: [{ isEnabled: 'desc' }, { name: 'asc' }],
      select: { id: true, name: true, phone: true, role: true, isEnabled: true },
    })

    const config = await prisma.systemConfig.findUnique({
      where: { key: CONFIG_KEY },
    })

    let weightMap: Record<string, number> = {}
    if (config?.value) {
      try {
        const parsed = JSON.parse(config.value)
        if (parsed && typeof parsed === 'object') {
          for (const [k, v] of Object.entries(parsed)) {
            const num = Number(v)
            if (Number.isFinite(num)) {
              weightMap[k] = num
            }
          }
        }
      } catch {
        // JSON 解析失败时使用默认值
      }
    }

    const result: PoolOperator[] = operators.map((op) => ({
      id: op.id,
      name: op.name,
      phone: op.phone,
      role: op.role,
      isEnabled: op.isEnabled,
      weight: Object.hasOwn(weightMap, op.id) ? weightMap[op.id] : DEFAULT_WEIGHT,
    }))

    return { success: true, operators: result }
  } catch (error) {
    console.error('获取教练审核分配池配置失败:', error)
    return { success: false, error: '获取配置失败' }
  }
}

export async function updateCoachReviewPoolConfig(
  weights: { operatorId: string; weight: number }[]
): Promise<{ success: boolean; error?: string }> {
  try {
    // Server Action 可被直调，服务端二次校验（超管专属）
    if (!(await isSuperAdmin())) {
      return { success: false, error: '仅超级管理员可修改初审随机分配池' }
    }
    for (const { weight } of weights) {
      if (weight < 0 || !Number.isFinite(weight)) {
        return { success: false, error: '权重无效，须为不小于 0 的数字' }
      }
    }

    const weightMap: Record<string, number> = {}
    for (const { operatorId, weight } of weights) {
      weightMap[operatorId] = weight
    }

    await recordAudit({
      actorType: 'ADMIN',
      actorId: 'super_admin',
      actorName: '管理员',
      action: 'UPDATE_FIRST_REVIEW_POOL',
      targetType: 'SYSTEM_CONFIG',
      targetId: CONFIG_KEY,
      detail: { to: weightMap },
    })

    await prisma.systemConfig.upsert({
      where: { key: CONFIG_KEY },
      create: { key: CONFIG_KEY, value: JSON.stringify(weightMap) },
      update: { value: JSON.stringify(weightMap) },
    })

    revalidatePath('/admin/config/coach-review-pool')
    revalidatePath('/admin/teachers')

    return { success: true }
  } catch (error) {
    console.error('更新教练审核分配池配置失败:', error)
    return { success: false, error: '保存配置失败' }
  }
}

/** 读取「运营复审权限」开关（默认关闭；value==='true' 才视为开启） */
export async function getFinalReviewSwitch(): Promise<{
  success: boolean
  enabled?: boolean
  error?: string
}> {
  if (!(await isSuperAdmin())) {
    return { success: false, error: '仅超级管理员可查看复审权限配置' }
  }
  const config = await prisma.systemConfig.findUnique({
    where: { key: OPERATOR_FINAL_REVIEW_KEY },
  })
  return { success: true, enabled: config?.value === 'true' }
}

export async function updateFinalReviewSwitch(
  enabled: boolean
): Promise<{ success: boolean; error?: string }> {
  if (!(await isSuperAdmin())) {
    return { success: false, error: '仅超级管理员可修改复审权限配置' }
  }

  const previous = await prisma.systemConfig.findUnique({
    where: { key: OPERATOR_FINAL_REVIEW_KEY },
  })
  const nextValue = enabled ? 'true' : 'false'

  await prisma.systemConfig.upsert({
    where: { key: OPERATOR_FINAL_REVIEW_KEY },
    create: { key: OPERATOR_FINAL_REVIEW_KEY, value: nextValue },
    update: { value: nextValue },
  })

  await recordAudit({
    actorType: 'ADMIN',
    actorId: 'super_admin',
    actorName: '管理员',
    action: 'OPERATOR_FINAL_REVIEW_SWITCH',
    targetType: 'SYSTEM_CONFIG',
    targetId: OPERATOR_FINAL_REVIEW_KEY,
    detail: { from: previous?.value ?? null, to: nextValue },
  })

  revalidatePath('/admin/config')
  revalidatePath('/admin/teachers')
  return { success: true }
}


const FINAL_REVIEW_POOL_KEY = 'COACH_FINAL_REVIEW_POOL'

/** 读取复审随机分配池配置（管理员设置各运营的复审分配比例） */
export async function getFinalReviewPoolConfig(): Promise<{
  success: boolean
  operators?: PoolOperator[]
  error?: string
}> {
  if (!(await isSuperAdmin())) {
    return { success: false, error: '仅超级管理员可查看复审分配池' }
  }
  try {
    // 学管无复审权：仅运营（OPERATOR）角色参与复审分配
    const operators = await prisma.operator.findMany({
      where: { role: 'OPERATOR' },
      orderBy: [{ isEnabled: 'desc' }, { name: 'asc' }],
      select: { id: true, name: true, phone: true, role: true, isEnabled: true },
    })

    const config = await prisma.systemConfig.findUnique({
      where: { key: FINAL_REVIEW_POOL_KEY },
    })

    let weightMap: Record<string, number> = {}
    if (config?.value) {
      try {
        const parsed = JSON.parse(config.value)
        if (parsed && typeof parsed === 'object') {
          for (const [k, v] of Object.entries(parsed)) {
            const num = Number(v)
            if (Number.isFinite(num)) weightMap[k] = num
          }
        }
      } catch {
        // JSON 解析失败时使用默认权重
      }
    }

    return {
      success: true,
      operators: operators.map((op) => ({
        id: op.id,
        name: op.name,
        phone: op.phone,
        role: op.role,
        isEnabled: op.isEnabled,
        weight: Object.hasOwn(weightMap, op.id) ? weightMap[op.id] : DEFAULT_WEIGHT,
      })),
    }
  } catch (error) {
    console.error('获取复审分配池配置失败:', error)
    return { success: false, error: '获取配置失败' }
  }
}

/** 保存复审随机分配池比例 */
export async function updateFinalReviewPoolConfig(
  weights: { operatorId: string; weight: number }[]
): Promise<{ success: boolean; error?: string }> {
  if (!(await isSuperAdmin())) {
    return { success: false, error: '仅超级管理员可修改复审分配池' }
  }
  try {
    for (const { weight } of weights) {
      if (weight < 0 || !Number.isFinite(weight)) {
        return { success: false, error: '权重无效，须为不小于 0 的数字' }
      }
    }

    const weightMap: Record<string, number> = {}
    for (const { operatorId, weight } of weights) {
      weightMap[operatorId] = weight
    }

    await recordAudit({
      actorType: 'ADMIN',
      actorId: 'super_admin',
      actorName: '管理员',
      action: 'UPDATE_FINAL_REVIEW_POOL',
      targetType: 'SYSTEM_CONFIG',
      targetId: FINAL_REVIEW_POOL_KEY,
      detail: { to: weightMap },
    })

    await prisma.systemConfig.upsert({
      where: { key: FINAL_REVIEW_POOL_KEY },
      create: { key: FINAL_REVIEW_POOL_KEY, value: JSON.stringify(weightMap) },
      update: { value: JSON.stringify(weightMap) },
    })

    revalidatePath('/admin/config/coach-review-pool')
    revalidatePath('/admin/teachers')

    return { success: true }
  } catch (error) {
    console.error('更新复审分配池配置失败:', error)
    return { success: false, error: '保存配置失败' }
  }
}