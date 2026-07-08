import { prisma } from '@/lib/prisma'

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
  source: 'api' | 'merged'
}

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

  // 2. 邀请人不是学管 → 查邀请人的上级学管
  const result = await fetchTutorInfo(inviterPhone)
  const managerPhone = result?.managerPhone ?? null

  if (!managerPhone) {
    return { operatorId: null, managerPhone: null, source: 'merged' }
  }

  const operator = await prisma.operator.findUnique({
    where: { phone: managerPhone },
    select: { id: true, isEnabled: true },
  })

  if (operator && operator.isEnabled) {
    return { operatorId: operator.id, managerPhone, source: 'api' }
  }

  return { operatorId: null, managerPhone, source: 'merged' }
}

export function isCoachReviewEligible(
  status: string,
  createdAt: Date
): boolean {
  return status === 'COMPLETED' && createdAt >= REVIEW_ELIGIBLE_SINCE
}
