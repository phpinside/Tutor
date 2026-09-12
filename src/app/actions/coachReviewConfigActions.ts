'use server'

import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'

const CONFIG_KEY = 'COACH_REVIEW_FALLBACK_POOL'
const DEFAULT_WEIGHT = 1

export type PoolOperator = {
  id: string
  name: string
  phone: string
  weight: number
  isEnabled: boolean
}

export async function getCoachReviewPoolConfig(): Promise<{
  success: boolean
  operators?: PoolOperator[]
  error?: string
}> {
  try {
    const operators = await prisma.operator.findMany({
      orderBy: [{ isEnabled: 'desc' }, { name: 'asc' }],
      select: { id: true, name: true, phone: true, isEnabled: true },
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
    for (const { weight } of weights) {
      if (weight < 0 || !Number.isFinite(weight)) {
        return { success: false, error: '权重无效，须为不小于 0 的数字' }
      }
    }

    const weightMap: Record<string, number> = {}
    for (const { operatorId, weight } of weights) {
      weightMap[operatorId] = weight
    }

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
