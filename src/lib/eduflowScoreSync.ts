import { prisma } from '@/lib/prisma'

// 2026-11：教练高考分数（含卷面总分）与接单系统（eduflow）保持一致。
// 分数发生变更（直改或资料修改申请复审通过生效）后，把最新分数推送给 eduflow，
// 接单系统的教练展示页分数随之同步。推送失败仅记录日志，绝不影响本系统主流程。
const EDUFLOW_SCORE_SYNC_URL =
  process.env.EDUFLOW_SCORE_SYNC_URL ||
  'https://flowapi.chulu.net/v1/external/coach-scores/sync'
const EDUFLOW_SCORE_SYNC_TOKEN = process.env.EDUFLOW_SCORE_SYNC_TOKEN

/** 教练成绩六件套（分数 + 卷面总分）与姓名，用于推送 */
export type CoachScores = {
  name?: string | null
  mathScore?: number | null
  mathScoreTotal?: number | null
  physicsScore?: number | null
  physicsScoreTotal?: number | null
  chemistryScore?: number | null
  chemistryScoreTotal?: number | null
}

const SCORE_SYNC_FIELDS = [
  'mathScore',
  'mathScoreTotal',
  'physicsScore',
  'physicsScoreTotal',
  'chemistryScore',
  'chemistryScoreTotal',
] as const

/** 给定变更字段集合，判断是否涉及分数（需要推送 eduflow） */
export function touchesScores(changedFields: Record<string, unknown>): boolean {
  return SCORE_SYNC_FIELDS.some((field) =>
    Object.prototype.hasOwnProperty.call(changedFields, field)
  )
}

/** 姓名变更（审核通过 / 运营直改）同样需要推送 eduflow 更新昵称（2026-11） */
export function touchesName(changedFields: Record<string, unknown>): boolean {
  return Object.prototype.hasOwnProperty.call(changedFields, 'name')
}

/**
 * 推送教练最新高考分数与姓名到 eduflow（fire-and-forget：失败只记日志，不抛出）。
 * `teacher` 需包含 id、name 与六项分数字段。
 */
export async function pushCoachScoreSync(
  teacher: { id: string } & CoachScores
): Promise<void> {
  if (!EDUFLOW_SCORE_SYNC_TOKEN) {
    console.warn('EDUFLOW_SCORE_SYNC_TOKEN 未配置，跳过 eduflow 分数同步推送', {
      teacherId: teacher.id,
    })
    return
  }
  try {
    const response = await fetch(EDUFLOW_SCORE_SYNC_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-External-Token': EDUFLOW_SCORE_SYNC_TOKEN,
      },
      body: JSON.stringify({
        tutorId: teacher.id,
        name: teacher.name ?? null,
        scores: {
          math: teacher.mathScore ?? null,
          mathTotal: teacher.mathScoreTotal ?? null,
          physics: teacher.physicsScore ?? null,
          physicsTotal: teacher.physicsScoreTotal ?? null,
          chemistry: teacher.chemistryScore ?? null,
          chemistryTotal: teacher.chemistryScoreTotal ?? null,
        },
      }),
      signal: AbortSignal.timeout(5000),
    })
    if (!response.ok) {
      console.error(
        `eduflow 分数同步推送失败: ${response.status} ${response.statusText}`,
        { teacherId: teacher.id }
      )
    }
  } catch (error) {
    console.error('eduflow 分数同步推送异常:', { teacherId: teacher.id, error })
  }
}

/** 从库中读取教练最新姓名与分数后推送（复审通过等场景使用） */
export async function pushCoachScoreSyncById(teacherId: string): Promise<void> {
  try {
    const teacher = await prisma.teacher.findUnique({
      where: { id: teacherId },
      select: {
        id: true,
        name: true,
        mathScore: true,
        mathScoreTotal: true,
        physicsScore: true,
        physicsScoreTotal: true,
        chemistryScore: true,
        chemistryScoreTotal: true,
      },
    })
    if (teacher) {
      await pushCoachScoreSync(teacher)
    }
  } catch (error) {
    console.error('eduflow 分数同步推送（读取教练分数）失败:', {
      teacherId,
      error,
    })
  }
}
