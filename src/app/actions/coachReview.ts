'use server'

import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import {
  isCoachReviewEligible,
  resolveFirstReviewerWithFallback,
} from '@/lib/externalTutor'
import { updateReferralStats } from './teacher'
import type { CoachReviewSnapshot } from '@/lib/coachReviewShared'

export type { CoachReviewSnapshot }

async function getTeacherSessionId() {
  const cookieStore = await cookies()
  return cookieStore.get('teacherId')?.value || null
}

async function getOperatorSession() {
  const cookieStore = await cookies()
  const session = cookieStore.get('operator_session')
  if (!session) return null
  try {
    const data = JSON.parse(session.value)
    if (!data.operatorId) return null
    return {
      operatorId: data.operatorId as string,
      name: (data.name as string) || '运营老师',
    }
  } catch {
    return null
  }
}

async function getSuperAdminSession() {
  const cookieStore = await cookies()
  const session = cookieStore.get('admin_session')
  if (!session) return null
  try {
    const data = JSON.parse(session.value)
    if (data.role === 'super_admin') {
      return { reviewerLabel: '超管' }
    }
    return null
  } catch {
    return null
  }
}

function toSnapshot(
  review: Awaited<ReturnType<typeof prisma.coachReview.findUnique>>
): CoachReviewSnapshot | null {
  if (!review) return null
  return {
    id: review.id,
    teacherId: review.teacherId,
    firstReviewOperatorId: review.firstReviewOperatorId,
    firstReviewVerdict: review.firstReviewVerdict,
    firstReviewedBy: review.firstReviewedBy,
    firstReviewedAt: review.firstReviewedAt,
    firstReviewNote: review.firstReviewNote,
    finalReviewVerdict: review.finalReviewVerdict,
    finalReviewedBy: review.finalReviewedBy,
    finalReviewedAt: review.finalReviewedAt,
    finalReviewNote: review.finalReviewNote,
    stage: review.stage,
    attemptCount: review.attemptCount,
    resolvedManagerPhone: review.resolvedManagerPhone,
    resolveSource: review.resolveSource,
    firstReviewOperatorName: null,
  }
}

export async function ensureCoachReview(
  teacherId: string
): Promise<{ success: boolean; created: boolean }> {
  try {
    const teacher = await prisma.teacher.findUnique({
      where: { id: teacherId },
      select: { id: true, status: true, createdAt: true },
    })

    if (!teacher) return { success: false, created: false }
    if (!isCoachReviewEligible(teacher.status, teacher.createdAt)) {
      return { success: true, created: false }
    }

    const existing = await prisma.coachReview.findUnique({
      where: { teacherId },
      select: { id: true },
    })
    if (existing) return { success: true, created: false }

    const directReferral = await prisma.referral.findFirst({
      where: {
        referredId: teacherId,
        type: 'DIRECT',
        status: 'PENDING',
      },
      select: {
        id: true,
        referrerId: true,
        referrer: { select: { phone: true } },
      },
    })

    if (!directReferral) return { success: true, created: false }

    const inviterPhone = directReferral.referrer?.phone ?? null
    const resolved = await resolveFirstReviewerWithFallback(teacherId, inviterPhone)

    await prisma.coachReview.create({
      data: {
        teacherId,
        firstReviewOperatorId: resolved.operatorId,
        resolvedManagerPhone: resolved.managerPhone,
        resolveSource: resolved.source,
        stage: 'FIRST_REVIEW',
      },
    })

    revalidatePath('/admin/teachers')
    revalidatePath(`/admin/teachers/${teacherId}`)

    return { success: true, created: true }
  } catch (error) {
    console.error('创建教练审核记录失败:', error)
    return { success: false, created: false }
  }
}

export async function getCoachReviewForTeacher(
  teacherId: string
): Promise<{ success: boolean; review: CoachReviewSnapshot | null }> {
  try {
    const review = await prisma.coachReview.findUnique({
      where: { teacherId },
      include: {
        teacher: { select: { name: true } },
      },
    })

    if (!review) return { success: true, review: null }

    let firstReviewOperatorName: string | null = null
    if (review.firstReviewOperatorId) {
      const op = await prisma.operator.findUnique({
        where: { id: review.firstReviewOperatorId },
        select: { name: true },
      })
      firstReviewOperatorName = op?.name ?? null
    }

    const snapshot = toSnapshot(review)
    if (snapshot) snapshot.firstReviewOperatorName = firstReviewOperatorName
    return { success: true, review: snapshot }
  } catch (error) {
    console.error('获取教练审核记录失败:', error)
    return { success: false, review: null }
  }
}

export async function getCoachReviewsForTeachers(
  teacherIds: string[]
): Promise<Map<string, CoachReviewSnapshot>> {
  const map = new Map<string, CoachReviewSnapshot>()
  if (teacherIds.length === 0) return map

  try {
    const reviews = await prisma.coachReview.findMany({
      where: { teacherId: { in: teacherIds } },
    })

    const operatorIds = [
      ...new Set(
        reviews
          .map((r) => r.firstReviewOperatorId)
          .filter((id): id is string => id !== null)
      ),
    ]

    const operators =
      operatorIds.length > 0
        ? await prisma.operator.findMany({
            where: { id: { in: operatorIds } },
            select: { id: true, name: true },
          })
        : []

    const opMap = new Map(operators.map((o) => [o.id, o.name]))

    for (const r of reviews) {
      const snap = toSnapshot(r)
      if (snap && snap.firstReviewOperatorId) {
        snap.firstReviewOperatorName =
          opMap.get(snap.firstReviewOperatorId) ?? null
      }
      map.set(r.teacherId, snap!)
    }

    return map
  } catch (error) {
    console.error('批量获取教练审核记录失败:', error)
    return map
  }
}

async function markReferralStatus(
  teacherId: string,
  status: 'VALID' | 'INVALID' | 'PENDING',
  note?: string,
  reviewedBy?: string
) {
  const directReferrals = await prisma.referral.findMany({
    where: { referredId: teacherId, type: 'DIRECT' },
    select: { id: true, referrerId: true },
  })

  if (directReferrals.length === 0) return

  for (const dr of directReferrals) {
    await prisma.referral.update({
      where: { id: dr.id },
      data: {
        status,
        adminNote: note ?? null,
        reviewedBy,
        reviewedAt: new Date(),
      },
    })
  }

  if (status === 'VALID' || status === 'INVALID') {
    await prisma.referral.updateMany({
      where: { referredId: teacherId, type: 'INDIRECT' },
      data: {
        status,
        reviewedBy,
        reviewedAt: new Date(),
      },
    })

    const indirectReferrals = await prisma.referral.findMany({
      where: { referredId: teacherId, type: 'INDIRECT' },
      select: { referrerId: true },
    })

    const referrerIds = new Set<string>()
    directReferrals.forEach((r) => referrerIds.add(r.referrerId))
    indirectReferrals.forEach((r) => referrerIds.add(r.referrerId))

    for (const rid of referrerIds) {
      await updateReferralStats(rid)
    }
  }
}

export async function submitFirstReview(
  reviewId: string,
  decision: 'APPROVED' | 'REJECTED',
  note?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const operatorSession = await getOperatorSession()
    if (!operatorSession) {
      return { success: false, error: '未登录' }
    }

    const review = await prisma.coachReview.findUnique({
      where: { id: reviewId },
      select: {
        id: true,
        teacherId: true,
        stage: true,
        firstReviewOperatorId: true,
        firstReviewVerdict: true,
        finalReviewVerdict: true,
      },
    })

    if (!review) return { success: false, error: '审核记录不存在' }
    if (review.firstReviewOperatorId !== operatorSession.operatorId) {
      return { success: false, error: '您不是该教练的初审人' }
    }
    if (review.stage !== 'FIRST_REVIEW') {
      return { success: false, error: '该记录不在初审阶段' }
    }
    if (review.firstReviewVerdict !== 'PENDING') {
      return { success: false, error: '初审已完成' }
    }
    if (review.finalReviewVerdict !== 'PENDING') {
      return { success: false, error: '该记录已完成终审' }
    }

    if (decision === 'REJECTED') {
      const trimmedNote = note?.trim()
      if (!trimmedNote) {
        return { success: false, error: '请填写驳回理由' }
      }

      await prisma.coachReview.update({
        where: { id: reviewId },
        data: {
          firstReviewVerdict: 'REJECTED',
          firstReviewedBy: operatorSession.name,
          firstReviewedAt: new Date(),
          firstReviewNote: trimmedNote,
          stage: 'REJECTED',
        },
      })

      await markReferralStatus(
        review.teacherId,
        'INVALID',
        trimmedNote,
        operatorSession.name
      )
    } else {
      await prisma.coachReview.update({
        where: { id: reviewId },
        data: {
          firstReviewVerdict: 'APPROVED',
          firstReviewedBy: operatorSession.name,
          firstReviewedAt: new Date(),
          stage: 'FINAL_REVIEW',
        },
      })
    }

    revalidatePath('/admin/teachers')
    revalidatePath(`/admin/teachers/${review.teacherId}`)
    revalidatePath('/onboarding')
    revalidatePath('/onboarding/complete')

    return { success: true }
  } catch (error) {
    console.error('初审提交失败:', error)
    return { success: false, error: '操作失败，请重试' }
  }
}

export async function submitFinalReview(
  reviewId: string,
  decision: 'APPROVED' | 'REJECTED',
  note?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const adminSession = await getSuperAdminSession()
    if (!adminSession) {
      return { success: false, error: '无权限，仅超管可复审' }
    }

    const review = await prisma.coachReview.findUnique({
      where: { id: reviewId },
      select: {
        id: true,
        teacherId: true,
        stage: true,
        firstReviewVerdict: true,
        finalReviewVerdict: true,
      },
    })

    if (!review) return { success: false, error: '审核记录不存在' }
    if (review.finalReviewVerdict !== 'PENDING') {
      return { success: false, error: '该记录已完成复审' }
    }

    if (decision === 'REJECTED') {
      const trimmedNote = note?.trim()
      if (!trimmedNote) {
        return { success: false, error: '请填写驳回理由' }
      }

      await prisma.coachReview.update({
        where: { id: reviewId },
        data: {
          finalReviewVerdict: 'REJECTED',
          finalReviewedBy: adminSession.reviewerLabel,
          finalReviewedAt: new Date(),
          finalReviewNote: trimmedNote,
          stage: 'REJECTED',
          ...(review.firstReviewVerdict === 'PENDING'
            ? { firstReviewVerdict: 'SKIPPED' as const }
            : {}),
        },
      })

      await markReferralStatus(
        review.teacherId,
        'INVALID',
        trimmedNote,
        adminSession.reviewerLabel
      )
    } else {
      await prisma.coachReview.update({
        where: { id: reviewId },
        data: {
          finalReviewVerdict: 'APPROVED',
          finalReviewedBy: adminSession.reviewerLabel,
          finalReviewedAt: new Date(),
          stage: 'APPROVED',
          ...(review.firstReviewVerdict === 'PENDING'
            ? { firstReviewVerdict: 'SKIPPED' as const }
            : {}),
        },
      })

      await markReferralStatus(review.teacherId, 'VALID')
    }

    revalidatePath('/admin/teachers')
    revalidatePath(`/admin/teachers/${review.teacherId}`)
    revalidatePath('/onboarding')
    revalidatePath('/onboarding/complete')
    revalidatePath('/admin/referrals')

    return { success: true }
  } catch (error) {
    console.error('复审提交失败:', error)
    return { success: false, error: '操作失败，请重试' }
  }
}

export async function batchSubmitFinalReview(
  teacherIds: string[],
  verdict: 'APPROVED' | 'REJECTED',
  note?: string
): Promise<{
  success: boolean
  results: { teacherId: string; ok: boolean; reason?: string }[]
}> {
  const results: { teacherId: string; ok: boolean; reason?: string }[] = []

  try {
    const adminSession = await getSuperAdminSession()
    if (!adminSession) {
      return { success: false, results }
    }

    if (!teacherIds || teacherIds.length === 0) {
      return { success: false, results }
    }

    const trimmedNote = note?.trim() || undefined

    if (verdict === 'REJECTED' && !trimmedNote) {
      return { success: false, results }
    }

    for (const teacherId of teacherIds) {
      try {
        const review = await prisma.coachReview.findUnique({
          where: { teacherId },
          select: {
            id: true,
            stage: true,
            firstReviewOperatorId: true,
            finalReviewVerdict: true,
          },
        })

        if (!review) {
          results.push({ teacherId, ok: false, reason: '审核记录不存在' })
          continue
        }
        if (review.stage !== 'FINAL_REVIEW' || !review.firstReviewOperatorId) {
          results.push({ teacherId, ok: false, reason: '不在两级待复审状态' })
          continue
        }
        if (review.finalReviewVerdict !== 'PENDING') {
          results.push({ teacherId, ok: false, reason: '复审已完成' })
          continue
        }

        if (verdict === 'APPROVED') {
          await prisma.coachReview.update({
            where: { id: review.id },
            data: {
              finalReviewVerdict: 'APPROVED',
              finalReviewedBy: adminSession.reviewerLabel,
              finalReviewedAt: new Date(),
              stage: 'APPROVED',
            },
          })
          await markReferralStatus(teacherId, 'VALID')
        } else {
          await prisma.coachReview.update({
            where: { id: review.id },
            data: {
              finalReviewVerdict: 'REJECTED',
              finalReviewedBy: adminSession.reviewerLabel,
              finalReviewedAt: new Date(),
              finalReviewNote: trimmedNote!,
              stage: 'REJECTED',
            },
          })
          await markReferralStatus(
            teacherId,
            'INVALID',
            trimmedNote,
            adminSession.reviewerLabel
          )
        }

        results.push({ teacherId, ok: true })
      } catch (err) {
        console.error(`批量复审失败 (${teacherId}):`, err)
        results.push({ teacherId, ok: false, reason: '操作异常' })
      }
    }

    revalidatePath('/admin/teachers')
    revalidatePath('/onboarding')
    revalidatePath('/onboarding/complete')
    revalidatePath('/admin/referrals')

    return { success: true, results }
  } catch (error) {
    console.error('批量复审提交失败:', error)
    return { success: false, results }
  }
}

export async function resubmitCoachReview(): Promise<{
  success: boolean
  error?: string
}> {
  try {
    const teacherId = await getTeacherSessionId()
    if (!teacherId) return { success: false, error: '未登录' }

    const review = await prisma.coachReview.findUnique({
      where: { teacherId },
      select: { id: true, stage: true },
    })

    if (!review) return { success: false, error: '审核记录不存在' }
    if (review.stage !== 'REJECTED') {
      return { success: false, error: '当前状态不可重新提交' }
    }

    await prisma.coachReview.update({
      where: { id: review.id },
      data: {
        stage: 'FIRST_REVIEW',
        firstReviewVerdict: 'PENDING',
        firstReviewedBy: null,
        firstReviewedAt: null,
        firstReviewNote: null,
        finalReviewVerdict: 'PENDING',
        finalReviewedBy: null,
        finalReviewedAt: null,
        finalReviewNote: null,
        attemptCount: { increment: 1 },
      },
    })

    await markReferralStatus(teacherId, 'PENDING')

    revalidatePath('/onboarding')
    revalidatePath('/onboarding/complete')
    revalidatePath('/admin/teachers')
    revalidatePath(`/admin/teachers/${teacherId}`)

    return { success: true }
  } catch (error) {
    console.error('重新提交教练审核失败:', error)
    return { success: false, error: '提交失败，请重试' }
  }
}

export type CoachReviewRejection = {
  note: string | null
  reviewedAt: Date | null
  stage: string
}

export async function getCoachReviewRejectionForReferred(
  teacherId: string
): Promise<CoachReviewRejection | null> {
  try {
    const review = await prisma.coachReview.findUnique({
      where: { teacherId },
      select: {
        stage: true,
        firstReviewNote: true,
        finalReviewNote: true,
        firstReviewedAt: true,
        finalReviewedAt: true,
      },
    })

    if (!review || review.stage !== 'REJECTED') return null

    const note =
      review.finalReviewNote || review.firstReviewNote || null
    const reviewedAt =
      review.finalReviewedAt || review.firstReviewedAt || null

    return { note, reviewedAt, stage: review.stage }
  } catch (error) {
    console.error('查询教练审核驳回失败:', error)
    return null
  }
}

export async function hasActiveCoachReview(
  teacherId: string
): Promise<boolean> {
  try {
    const review = await prisma.coachReview.findUnique({
      where: { teacherId },
      select: { stage: true },
    })
    if (!review) return false
    return review.stage !== 'APPROVED'
  } catch {
    return false
  }
}
