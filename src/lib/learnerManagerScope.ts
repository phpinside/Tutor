import { cache } from 'react'
import { prisma } from '@/lib/prisma'
import type { Prisma } from '@prisma/client'

/**
 * 学管数据白名单 scoping（灰度开关驱动）。
 *
 * 可见白名单（满足任一条件的老师）：
 *  A. 已归属（跟进）该学管：TeacherTeam.operatorId = X（即「团队人员管理」名单）
 *  B. 分配给该学管初审且职责期内：CoachReview.firstReviewOperatorId = X
 *     且 stage ∈ {FIRST_REVIEW, REJECTED}
 *  C. 该学管自己邀请的人员：按 Operator.phone 匹配老师身份后 invitedById = 该老师ID
 *
 * 灰度开关：SystemConfig key = 'LEARNER_MANAGER_SCOPE'，值为 JSON 字符串：
 *  - '[]' 或缺省：关闭，所有学管保持改造前行为（返回 null，调用方走现状逻辑）
 *  - '["*"]'：全量启用
 *  - '["<operatorId>", ...]'：仅指定学管启用
 * 开关可在 /admin/config 页面调整，变更即时生效（下一请求）。
 */

export const LEARNER_MANAGER_SCOPE_KEY = 'LEARNER_MANAGER_SCOPE'

/** 读取灰度开关配置；解析失败一律视为关闭（安全默认 = 现状行为） */
export const getLearnerManagerScopeConfig = cache(async (): Promise<string[]> => {
  try {
    const config = await prisma.systemConfig.findUnique({
      where: { key: LEARNER_MANAGER_SCOPE_KEY },
    })
    if (!config?.value) return []
    const parsed = JSON.parse(config.value)
    if (!Array.isArray(parsed)) return []
    return parsed.filter((item): item is string => typeof item === 'string')
  } catch {
    return []
  }
})

/** 该学管是否启用白名单 scoping（仅 LEARNER_MANAGER 角色可启用；OPERATOR 运营角色永远保持全量） */
export const isScopingEnabledFor = cache(async (operatorId: string): Promise<boolean> => {
  const operator = await prisma.operator.findUnique({
    where: { id: operatorId },
    select: { role: true },
  })
  if (!operator || operator.role !== 'LEARNER_MANAGER') return false

  const list = await getLearnerManagerScopeConfig()
  if (list.length === 0) return false
  return list.includes('*') || list.includes(operatorId)
})

/**
 * 学管数据白名单 where 条件。
 * 返回 null 表示该学管未启用 scoping（调用方保持现状逻辑，即全量可见）。
 */
export const getScopedTeacherFilter = cache(
  async (operatorId: string): Promise<Prisma.TeacherWhereInput | null> => {
    if (!(await isScopingEnabledFor(operatorId))) return null

    // 条件 C：按手机号匹配学管对应的老师身份（与外部接口解析口径一致）
    // 注意：匹配不到时必须整体省略条件 C——绝不能写 invitedById: null，
    // 否则会误匹配所有无邀请人的老师（越权漏洞）。
    const operator = await prisma.operator.findUnique({
      where: { id: operatorId },
      select: { phone: true },
    })
    let selfTeacherId: string | null = null
    if (operator?.phone) {
      const selfTeacher = await prisma.teacher.findUnique({
        where: { phone: operator.phone },
        select: { id: true },
      })
      selfTeacherId = selfTeacher?.id ?? null
    }

    const or: Prisma.TeacherWhereInput[] = [
      // 条件 A：团队人员管理名单（系统分配认领 + 主动认领 + 超管指派）
      { teamAssignment: { is: { operatorId } } },
      // 条件 B：分配给我的、职责期内的教练初审
      {
        coachReview: {
          is: {
            firstReviewOperatorId: operatorId,
            stage: { in: ['FIRST_REVIEW', 'REJECTED'] },
          },
        },
      },
    ]
    if (selfTeacherId) {
      or.push({ invitedById: selfTeacherId })
    }

    return { OR: or }
  }
)

/**
 * 判定某老师是否在某学管的可见白名单内（用于写操作的范围校验）。
 * 返回 null 表示该学管未启用 scoping（按现状逻辑处理，不拦截）。
 */
export async function isTeacherInScope(
  operatorId: string,
  teacherId: string
): Promise<boolean | null> {
  const scoped = await getScopedTeacherFilter(operatorId)
  if (!scoped) return null
  const teacher = await prisma.teacher.findFirst({
    where: { id: teacherId, AND: [scoped] },
    select: { id: true },
  })
  return Boolean(teacher)
}

/** 学管本人是否有对应老师身份（返回其 teacherId 或 null） */
export async function getSelfTeacherIdOfOperator(
  operatorId: string
): Promise<string | null> {
  const operator = await prisma.operator.findUnique({
    where: { id: operatorId },
    select: { phone: true },
  })
  if (!operator?.phone) return null
  const selfTeacher = await prisma.teacher.findUnique({
    where: { phone: operator.phone },
    select: { id: true },
  })
  return selfTeacher?.id ?? null
}
