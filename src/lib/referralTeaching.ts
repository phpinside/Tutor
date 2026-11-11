import 'server-only'

import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import { updateReferralStats } from '@/app/actions/teacher'

// 仅供已鉴权的服务端入口使用，不导出为 Server Action。
export async function getPendingTeachingReferrals(afterId?: string, pageSize = 50) {
  return prisma.referral.findMany({
    where: {
      status: 'VALID',
      teachingCompletedAt: null,
      ...(afterId ? { id: { gt: afterId } } : {}),
    },
    select: {
      id: true,
      type: true,
      referred: { select: { id: true, name: true, phone: true } },
    },
    orderBy: { id: 'asc' },
    take: pageSize,
  })
}

// 调用方负责鉴权：后台校验超管会话，Cron 校验 CRON_SECRET。
export async function completeReferralTeaching(
  referralId: string,
  lessonNote: string,
  reviewedBy?: string
) {
  try {
    if (!lessonNote?.trim()) {
      return { success: false, error: '请填写授课备注' }
    }

    const referral = await prisma.referral.findUnique({
      where: { id: referralId },
      include: {
        referred: { select: { id: true, teachingStatus: true } },
      },
    })

    if (!referral) {
      return { success: false, error: '邀请记录不存在' }
    }
    if (referral.teachingCompletedAt) {
      return { success: false, error: '该邀请记录已标记为授课完成' }
    }

    if (referral.referred.teachingStatus !== 'TAUGHT') {
      await prisma.teacher.update({
        where: { id: referral.referredId },
        data: { teachingStatus: 'TAUGHT' },
      })
    }

    const completedAt = new Date()
    await prisma.referral.update({
      where: { id: referralId },
      data: {
        lessonNote,
        verifiedBy: reviewedBy,
        verifiedAt: completedAt,
        teachingCompletedAt: completedAt,
      },
    })

    await updateReferralStats(referral.referrerId)

    if (referral.type === 'DIRECT') {
      const indirectReferrals = await prisma.referral.findMany({
        where: { referredId: referral.referredId, type: 'INDIRECT' },
        select: { referrerId: true },
      })
      for (const ir of indirectReferrals) {
        await updateReferralStats(ir.referrerId)
      }
    }

    revalidatePath('/admin/referrals')
    revalidatePath('/referral/dashboard')
    return { success: true }
  } catch (error) {
    console.error('标记授课完成失败:', error)
    return { success: false, error: '操作失败，请重试' }
  }
}
