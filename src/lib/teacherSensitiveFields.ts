import { cache } from 'react'
import { prisma } from '@/lib/prisma'

/**
 * 教练敏感资料字段：入驻通过（CoachReview.stage = APPROVED）后，
 * 教练本人与学管（LEARNER_MANAGER）不可直接修改，需走「资料修改申请」审核流程。
 * 超管与运营（OPERATOR）可直接修改。
 */
export const SENSITIVE_FIELDS = [
  'name',
  'gaokaoProvince',
  'mathScore',
  'physicsScore',
  'chemistryScore',
  'mathScoreTotal',
  'physicsScoreTotal',
  'chemistryScoreTotal',
] as const

export type SensitiveField = (typeof SENSITIVE_FIELDS)[number]

export const SENSITIVE_FIELD_SET: ReadonlySet<string> = new Set(SENSITIVE_FIELDS)

export const SENSITIVE_FIELD_LABELS: Record<SensitiveField, string> = {
  name: '姓名',
  gaokaoProvince: '高考省份',
  mathScore: '高考数学成绩',
  physicsScore: '高考物理成绩',
  chemistryScore: '高考化学成绩',
  mathScoreTotal: '高考数学卷面总分',
  physicsScoreTotal: '高考物理卷面总分',
  chemistryScoreTotal: '高考化学卷面总分',
}

/**
 * 教练是否已通过入驻审核（初审 + 复审均通过）。
 * 无审核记录 / 处于任意中间阶段均视为未通过。
 */
export const hasPassedOnboarding = cache(async (teacherId: string): Promise<boolean> => {
  const review = await prisma.coachReview.findUnique({
    where: { teacherId },
    select: { stage: true },
  })
  return review?.stage === 'APPROVED'
})

/**
 * 运营侧角色是否允许直接修改敏感字段。
 * 仅 OPERATOR 角色允许；LEARNER_MANAGER（学管）一律不允许。
 */
export function canDirectEditSensitiveFields(operatorRole: string | null | undefined): boolean {
  return operatorRole === 'OPERATOR'
}

/** 值是否等价（null/undefined 归一化后比较，兼容对象/数组/标量） */
export function isSameValue(a: unknown, b: unknown): boolean {
  return JSON.stringify(a ?? null) === JSON.stringify(b ?? null)
}

/** 成绩-卷面总分成对关系 */
export const SCORE_TOTAL_PAIRS: [SensitiveField, SensitiveField][] = [
  ['mathScore', 'mathScoreTotal'],
  ['physicsScore', 'physicsScoreTotal'],
  ['chemistryScore', 'chemistryScoreTotal'],
]

/** 卷面总分取值范围（单科最高 150 分） */
export const SCORE_TOTAL_MIN = 30
export const SCORE_TOTAL_MAX = 150

/**
 * 成绩-总分交叉校验：以「变更后」的成对值判断（变更值优先，缺省取当前值）。
 * record 为当前教师记录，changes 为本次变更（key → { to }），仅要求提供发生变更的 key。
 * 返回 null 表示通过。
 */
export function validateScoreTotalPair(
  record: Record<string, unknown>,
  changes: Record<string, { to: unknown }>
): string | null {
  for (const [scoreKey, totalKey] of SCORE_TOTAL_PAIRS) {
    const score = changes[scoreKey] ? changes[scoreKey].to : record[scoreKey]
    const total = changes[totalKey] ? changes[totalKey].to : record[totalKey]
    if (typeof score === 'number' && typeof total === 'number' && score > total) {
      const label = SENSITIVE_FIELD_LABELS[scoreKey]
      return `${label}（${score}）不能高于卷面总分（${total}）`
    }
  }
  return null
}
