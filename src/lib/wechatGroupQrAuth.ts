import { prisma } from '@/lib/prisma'
import { getOperatorSessionInfo, isSuperAdminRequest } from '@/lib/operatorAuth'
import { isOperatorFinalReviewEnabled } from '@/app/actions/coachReview'

/**
 * 微信群二维码配置权限：
 * - 超管：始终可以
 * - 运营（role=OPERATOR，启用状态）：仅当「运营复审权限」开关开启时可以
 * - 学管（LEARNER_MANAGER）：不可以
 *
 * 该能力随「运营复审权限」开关联动：开关关闭时同步关闭。
 */
export async function canManageWechatGroupQr(): Promise<boolean> {
  if (await isSuperAdminRequest()) return true

  const session = await getOperatorSessionInfo()
  if (!session) return false

  const operator = await prisma.operator.findUnique({
    where: { id: session.operatorId },
    select: { role: true, isEnabled: true },
  })
  if (!operator || !operator.isEnabled || operator.role !== 'OPERATOR') return false

  return isOperatorFinalReviewEnabled()
}
