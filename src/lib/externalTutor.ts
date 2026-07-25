import { prisma } from '@/lib/prisma'
import { COACH_REVIEW_FALLBACK_POOL } from '@/lib/coachReviewConfig'

// 复用现有 cron 已验证的接口配置
const TUTOR_INFO_API_URL =
  process.env.EXTERNAL_TUTOR_API_URL ||
  'https://flowapi.chulu.net/v1/external/tutors/info'
const TUTOR_API_TOKEN = process.env.EXTERNAL_TUTOR_API_TOKEN

// 北京时间 2025-06-01 00:00:00（UTC = 2025-05-31 16:00:00）
export const REVIEW_ELIGIBLE_SINCE = new Date('2025-05-31T16:00:00Z')

type TutorInfoResponse = {
  success: boolean
  data?: {
    name?: string
    phone?: string
    tutorId?: string
    managerPhone?: string
    regularLessonHours?: number
  }
  error?: string
  message?: string
} | null

export async function fetchTutorInfo(
  phone: string
): Promise<{ managerPhone?: string } | null> {
  if (!TUTOR_API_TOKEN) {
    console.error('EXTERNAL_TUTOR_API_TOKEN 环境变量未设置')
    return null
  }

  try {
    const url = new URL(TUTOR_INFO_API_URL)
    url.searchParams.set('phone', phone)

    const response = await fetch(url.toString(), {
      method: 'GET',
      redirect: 'follow',
      headers: {
        'X-External-Token': TUTOR_API_TOKEN,
        Accept: '*/*',
        'User-Agent': 'TutorOnboarding/1.0.0',
      },
    })

    if (!response.ok) {
      console.error(`外部API调用失败: ${response.status} ${response.statusText}`)
      return null
    }

    const data: TutorInfoResponse = await response.json()
    if (data?.success && data.data?.managerPhone) {
      return { managerPhone: data.data.managerPhone }
    }

    return null
  } catch (error) {
    console.error('查询学管信息失败:', error)
    return null
  }
}

export type ResolveResult = {
  operatorId: string | null
  managerPhone: string | null
  source: 'api' | 'merged' | 'team_assignment' | 'random_assignment'
}

// 递归向上查找的最大层数，防止异常组织架构导致无限递归
const RESOLVE_MAX_DEPTH = 5

export async function resolveFirstReviewer(
  inviterPhone: string | null
): Promise<ResolveResult> {
  if (!inviterPhone) {
    return { operatorId: null, managerPhone: null, source: 'merged' }
  }

  // 1. 邀请人本人就是学管（运营）→ 邀请人自己初审
  const inviterAsOperator = await prisma.operator.findUnique({
    where: { phone: inviterPhone },
    select: { id: true, isEnabled: true },
  })

  if (inviterAsOperator && inviterAsOperator.isEnabled) {
    return { operatorId: inviterAsOperator.id, managerPhone: inviterPhone, source: 'api' }
  }

  // 2. 邀请人不是学管 → 逐级向上查找其上级学管：
  //    以当前手机号调外部接口取上级学管手机号，再查 Operator 表；
  //    若未命中启用运营，则以该上级学管手机号为新的当前手机号继续向上，
  //    直到命中启用运营、到达组织架构顶层、检测到环或超过最大深度。
  const visited = new Set<string>([inviterPhone])
  let currentPhone = inviterPhone
  let lastManagerPhone: string | null = null

  for (let depth = 0; depth < RESOLVE_MAX_DEPTH; depth++) {
    const result = await fetchTutorInfo(currentPhone)
    const managerPhone = result?.managerPhone ?? null

    if (!managerPhone) {
      // 已到组织架构顶层，无更高级别学管
      return { operatorId: null, managerPhone: lastManagerPhone, source: 'merged' }
    }

    lastManagerPhone = managerPhone

    // 防环：同一手机号重复出现则终止
    if (visited.has(managerPhone)) {
      return { operatorId: null, managerPhone, source: 'merged' }
    }
    visited.add(managerPhone)

    const operator = await prisma.operator.findUnique({
      where: { phone: managerPhone },
      select: { id: true, isEnabled: true },
    })

    if (operator && operator.isEnabled) {
      return { operatorId: operator.id, managerPhone, source: 'api' }
    }

    // 当前上级学管未启用 / 本地不存在 → 继续向上查找
    currentPhone = managerPhone
  }

  // 超过最大递归深度仍未命中启用运营
  return { operatorId: null, managerPhone: lastManagerPhone, source: 'merged' }
}

// 加权随机兜底运营池条目
type FallbackPoolEntry = {
  phone: string
  operatorId: string
  weight: number
}

// 读取并校验加权随机兜底运营池（来自配置文件 src/lib/coachReviewConfig.ts）
// "*" 通配符 = 全部启用运营等权；具体手机号须为已启用运营，否则忽略
export async function getCoachReviewFallbackPool(): Promise<FallbackPoolEntry[]> {
  try {
    // 通配模式："*" 表示全部启用运营，权重为该值（忽略其它具体手机号）
    const wildcardWeight = COACH_REVIEW_FALLBACK_POOL['*']
    if (typeof wildcardWeight === 'number' && wildcardWeight > 0) {
      const operators = await prisma.operator.findMany({
        where: { isEnabled: true },
        select: { id: true, phone: true },
        orderBy: { phone: 'asc' },
      })
      return operators.map((o) => ({
        phone: o.phone,
        operatorId: o.id,
        weight: wildcardWeight,
      }))
    }

    // 显式模式：手机号 -> 权重
    const entries = Object.entries(COACH_REVIEW_FALLBACK_POOL).filter(
      ([p, w]) => p !== '*' && typeof w === 'number' && w > 0
    )
    if (entries.length === 0) return []

    const phones = entries.map(([p]) => p)
    const operators = await prisma.operator.findMany({
      where: { phone: { in: phones }, isEnabled: true },
      select: { id: true, phone: true },
    })
    const operatorIdByPhone = new Map(operators.map((o) => [o.phone, o.id]))

    const pool: FallbackPoolEntry[] = []
    for (const [phone, weight] of entries) {
      const operatorId = operatorIdByPhone.get(phone)
      if (!operatorId) continue // 非合法 / 未启用运营手机号 → 丢弃
      pool.push({ phone, operatorId, weight })
    }
    // 按手机号排序，保证 seededWeightedPick 不受配置键顺序影响
    pool.sort((a, b) => (a.phone < b.phone ? -1 : a.phone > b.phone ? 1 : 0))
    return pool
  } catch (error) {
    console.error('读取加权随机兜底运营池失败:', error)
    return []
  }
}

// 以 seed 确定性地按权重从池中挑选一个运营
// 同一 seed 在相同池/权重下结果稳定，避免 redistribute / backfill 重跑导致分配漂移
function seededWeightedPick(
  pool: FallbackPoolEntry[],
  seed: string
): FallbackPoolEntry | null {
  if (pool.length === 0) return null

  // FNV-1a 哈希得到 32 位种子
  let h = 2166136261
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }

  // mulberry32 伪随机数生成器
  let a = h >>> 0
  const rand = () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }

  const total = pool.reduce((s, p) => s + p.weight, 0)
  let r = rand() * total
  for (const entry of pool) {
    r -= entry.weight
    if (r < 0) return entry
  }
  return pool[pool.length - 1]
}

// 获取全部启用运营作为等权兜底池（配置池为空时使用，确保每个教练都能分配到运营）
// orderBy 保证顺序稳定，从而 seededWeightedPick 对同一 teacherId 结果确定
async function getAllEnabledOperatorsAsPool(): Promise<FallbackPoolEntry[]> {
  const operators = await prisma.operator.findMany({
    where: { isEnabled: true },
    select: { id: true, phone: true },
    orderBy: { phone: 'asc' },
  })
  return operators.map((o) => ({ phone: o.phone, operatorId: o.id, weight: 1 }))
}

// 完整初审人解析：外部接口递归向上 → 团队认领人兜底 → 加权随机兜底
// 三级兜底任一命中即返回；全部未命中则返回 source='merged'（合并审核）
export async function resolveFirstReviewerWithFallback(
  teacherId: string,
  inviterPhone: string | null
): Promise<ResolveResult> {
  let resolved = await resolveFirstReviewer(inviterPhone)

  // 兜底 1：团队认领人（TeacherTeam.operator）
  if (!resolved.operatorId) {
    const teamAssignment = await prisma.teacherTeam.findUnique({
      where: { teacherId },
      select: { operator: { select: { id: true, isEnabled: true } } },
    })
    if (teamAssignment?.operator?.isEnabled) {
      resolved = {
        operatorId: teamAssignment.operator.id,
        managerPhone: resolved.managerPhone,
        source: 'team_assignment',
      }
    }
  }

  // 兜底 2：加权随机分配（确保每个教练都能分配到运营负责）
  if (!resolved.operatorId) {
    let pool = await getCoachReviewFallbackPool()
    if (pool.length === 0) {
      // 配置池未配置 / 全部非法 → 退化为全部启用运营等权分配，
      // 保证只要系统中存在启用运营，教练就一定能被分配
      pool = await getAllEnabledOperatorsAsPool()
    }
    const picked = seededWeightedPick(pool, teacherId)
    if (picked) {
      resolved = {
        operatorId: picked.operatorId,
        managerPhone: resolved.managerPhone,
        source: 'random_assignment',
      }
    } else {
      // 系统中无任何启用运营，无法分配（属系统配置异常，正常不会发生）
      console.error(
        '加权随机兜底失败：系统中无任何启用运营，教练无法分配初审人',
        { teacherId }
      )
    }
  }

  return resolved
}

export function isCoachReviewEligible(
  status: string,
  createdAt: Date
): boolean {
  return status === 'COMPLETED' && createdAt >= REVIEW_ELIGIBLE_SINCE
}
