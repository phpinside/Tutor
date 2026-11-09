'use server'

import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import {
  isCoachReviewEligible,
  resolveFirstReviewerUnified,
  getFinalReviewPool,
  seededWeightedPick,
} from '@/lib/externalTutor'
import { updateReferralStats } from './teacher'
import { recordAudit } from '@/lib/auditLog'
import type { CoachReviewSnapshot } from '@/lib/coachReviewShared'
import { QUALIFICATION_TYPE_LABELS } from '@/lib/teacherQualificationShared'
import type { QualificationType } from '@/lib/teacherQualificationShared'

// 与 coachReviewConfigActions.ts 中的开关键保持一致（该文件为 "use server"，不可导出常量）
const OPERATOR_FINAL_REVIEW_KEY = 'OPERATOR_FINAL_REVIEW_ENABLED'

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

/** 「运营复审权限」开关是否开启（value === 'true' 视为开启；缺省/异常一律关闭） */
export async function isOperatorFinalReviewEnabled(): Promise<boolean> {
  try {
    const config = await prisma.systemConfig.findUnique({
      where: { key: OPERATOR_FINAL_REVIEW_KEY },
    })
    return config?.value === 'true'
  } catch {
    return false
  }
}

/**
 * 当前会话是否具备复审权限：
 * - 超管：始终可以
 * - 运营（role=OPERATOR，启用状态）：仅当「运营复审权限」开关开启时可以
 * 学管（LEARNER_MANAGER）不具备复审权限。
 */
export async function canPerformFinalReview(): Promise<boolean> {
  const adminSession = await getSuperAdminSession()
  if (adminSession) return true

  const operatorSession = await getOperatorSession()
  if (!operatorSession) return false

  const operator = await prisma.operator.findUnique({
    where: { id: operatorSession.operatorId },
    select: { role: true, isEnabled: true },
  })
  if (!operator || !operator.isEnabled || operator.role !== 'OPERATOR') return false

  return isOperatorFinalReviewEnabled()
}

/**
 * 复审执行身份。允许：
 * - 超管（任意复审单）
 * - 被随机分配为复审人的运营/学管（仅限该单）
 * - 运营（OPERATOR）角色且「运营复审权限」开关开启（任意复审单，既有能力）
 */
async function getFinalReviewSession(
  review?: { finalReviewOperatorId: string | null }
): Promise<{ reviewerLabel: string; operatorId: string | null } | null> {
  const adminSession = await getSuperAdminSession()
  if (adminSession) {
    return { reviewerLabel: adminSession.reviewerLabel, operatorId: null }
  }

  const operatorSession = await getOperatorSession()
  if (!operatorSession) return null

  const operator = await prisma.operator.findUnique({
    where: { id: operatorSession.operatorId },
    select: { role: true, isEnabled: true },
  })
  if (!operator || !operator.isEnabled) return null

  // 被随机分配的复审人（仅运营角色；学管无复审权，分配池已排除，此处二次校验）
  if (
    operator.role === 'OPERATOR' &&
    review?.finalReviewOperatorId &&
    review.finalReviewOperatorId === operatorSession.operatorId
  ) {
    return { reviewerLabel: operatorSession.name, operatorId: operatorSession.operatorId }
  }

  // 既有能力：运营（OPERATOR）角色 + 复审开关开启 → 可复审全部
  if (operator.role === 'OPERATOR' && (await isOperatorFinalReviewEnabled())) {
    return { reviewerLabel: operatorSession.name, operatorId: operatorSession.operatorId }
  }

  return null
}

/** 初审通过进入复审时：按复审分配池比例随机指派复审运营（仅运营角色，排除初审人本人；池空则留给超管） */
async function pickFinalReviewer(
  teacherId: string,
  excludeOperatorId: string | null
): Promise<string | null> {
  try {
    const pool = await getFinalReviewPool()
    const candidates =
      pool.length > 1 && excludeOperatorId
        ? pool.filter((p) => p.operatorId !== excludeOperatorId)
        : pool
    if (candidates.length === 0) return null
    const picked = seededWeightedPick(candidates, `${teacherId}:final`)
    return picked?.operatorId ?? null
  } catch (error) {
    console.error('复审随机分配失败:', error)
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
    finalReviewOperatorId: review.finalReviewOperatorId,
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
    challengeFromStage: review.challengeFromStage,
    resolvedManagerPhone: review.resolvedManagerPhone,
    resolveSource: review.resolveSource,
    firstReviewOperatorName: null,
    finalReviewOperatorName: null,
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
    // 统一分配模型：优先使用注册时已确定的跟进人（TeacherTeam）作为初审人，
    // 无跟进人或运营已禁用时才回退到完整解析链
    const resolved = await resolveFirstReviewerUnified(teacherId, inviterPhone)

    await prisma.coachReview.create({
      data: {
        teacherId,
        firstReviewOperatorId: resolved.operatorId,
        resolvedManagerPhone: resolved.managerPhone,
        resolveSource: resolved.source,
        stage: 'FIRST_REVIEW',
      },
    })

    // 统一分配模型：保持「跟进人 = 初审人」。
    // 无跟进人时创建；已有跟进人但解析结果不同（原跟进运营已被禁用等）时覆盖。
    if (resolved.operatorId) {
      await prisma.teacherTeam.upsert({
        where: { teacherId },
        update: { operatorId: resolved.operatorId },
        create: { teacherId, operatorId: resolved.operatorId },
      })
    }

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

    let finalReviewOperatorName: string | null = null
    if (review.finalReviewOperatorId) {
      const op = await prisma.operator.findUnique({
        where: { id: review.finalReviewOperatorId },
        select: { name: true },
      })
      finalReviewOperatorName = op?.name ?? null
    }

    const snapshot = toSnapshot(review)
    if (snapshot) {
      snapshot.firstReviewOperatorName = firstReviewOperatorName
      snapshot.finalReviewOperatorName = finalReviewOperatorName
    }
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
          .flatMap((r) => [r.firstReviewOperatorId, r.finalReviewOperatorId])
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
      if (snap) {
        if (snap.firstReviewOperatorId) {
          snap.firstReviewOperatorName = opMap.get(snap.firstReviewOperatorId) ?? null
        }
        if (snap.finalReviewOperatorId) {
          snap.finalReviewOperatorName = opMap.get(snap.finalReviewOperatorId) ?? null
        }
        map.set(r.teacherId, snap)
      }
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
  decision: 'APPROVED' | 'REJECTED' | 'PERMANENTLY_REJECTED',
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
    } else if (decision === 'PERMANENTLY_REJECTED') {
      const trimmedNote = note?.trim()
      if (!trimmedNote) {
        return { success: false, error: '请填写拒绝理由' }
      }

      await prisma.$transaction([
        prisma.coachReview.update({
          where: { id: reviewId },
          data: {
            firstReviewVerdict: 'REJECTED',
            firstReviewedBy: operatorSession.name,
            firstReviewedAt: new Date(),
            firstReviewNote: trimmedNote,
            stage: 'PERMANENTLY_REJECTED',
          },
        }),
        prisma.teacher.update({
          where: { id: review.teacherId },
          data: {
            permanentlyRejectedAt: new Date(),
            permanentlyRejectedBy: operatorSession.name,
          },
        }),
      ])

      await markReferralStatus(
        review.teacherId,
        'INVALID',
        trimmedNote,
        operatorSession.name
      )
    } else {
      // 初审通过 → 进入复审：按管理员配置的分配比例在生效运营中随机指派复审人（排除初审人本人）
      const finalReviewOperatorId = await pickFinalReviewer(
        review.teacherId,
        review.firstReviewOperatorId
      )
      await prisma.coachReview.update({
        where: { id: reviewId },
        data: {
          firstReviewVerdict: 'APPROVED',
          firstReviewedBy: operatorSession.name,
          firstReviewedAt: new Date(),
          stage: 'FINAL_REVIEW',
          finalReviewOperatorId,
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
  decision: 'APPROVED' | 'REJECTED' | 'PERMANENTLY_REJECTED',
  note?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const review = await prisma.coachReview.findUnique({
      where: { id: reviewId },
      select: {
        id: true,
        teacherId: true,
        stage: true,
        firstReviewVerdict: true,
        finalReviewVerdict: true,
        finalReviewOperatorId: true,
      },
    })

    // 复审权限：超管 / 被随机分配的复审人 / 开关开启的运营角色
    const finalReviewSession = await getFinalReviewSession(review ?? undefined)
    if (!finalReviewSession) {
      return { success: false, error: '无权限，复审仅限超管、被分配的复审人或已授权的运营' }
    }
    const reviewerLabel = finalReviewSession.reviewerLabel

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
          finalReviewedBy: reviewerLabel,
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
        reviewerLabel
      )
    } else if (decision === 'PERMANENTLY_REJECTED') {
      const trimmedNote = note?.trim()
      if (!trimmedNote) {
        return { success: false, error: '请填写拒绝理由' }
      }

      await prisma.$transaction([
        prisma.coachReview.update({
          where: { id: reviewId },
          data: {
            finalReviewVerdict: 'REJECTED',
            finalReviewedBy: reviewerLabel,
            finalReviewedAt: new Date(),
            finalReviewNote: trimmedNote,
            stage: 'PERMANENTLY_REJECTED',
            ...(review.firstReviewVerdict === 'PENDING'
              ? { firstReviewVerdict: 'SKIPPED' as const }
              : {}),
          },
        }),
        prisma.teacher.update({
          where: { id: review.teacherId },
          data: {
            permanentlyRejectedAt: new Date(),
            permanentlyRejectedBy: reviewerLabel,
          },
        }),
      ])

      await markReferralStatus(
        review.teacherId,
        'INVALID',
        trimmedNote,
        reviewerLabel
      )
    } else {
      await prisma.coachReview.update({
        where: { id: reviewId },
        data: {
          finalReviewVerdict: 'APPROVED',
          finalReviewedBy: reviewerLabel,
          finalReviewedAt: new Date(),
          stage: 'APPROVED',
          ...(review.firstReviewVerdict === 'PENDING'
            ? { firstReviewVerdict: 'SKIPPED' as const }
            : {}),
        },
      })

      await markReferralStatus(review.teacherId, 'VALID')
    }

    await recordAudit({
      actorType: finalReviewSession.operatorId ? 'OPERATOR' : 'ADMIN',
      actorId: finalReviewSession.operatorId ?? 'super_admin',
      actorName: finalReviewSession.operatorId ? reviewerLabel : '管理员',
      action: 'FINAL_REVIEW',
      targetType: 'TEACHER',
      targetId: review.teacherId,
      detail: { decision, fromStage: review.stage },
    })

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

/**
 * 直接通过（管理员/运营专用）：
 * 跳过任务流程与两级审核，直接将教练标记为审核通过，并归正入驻状态。
 * 用于早期未走完整入驻流程的存量教练的状态修复。
 * - 无 CoachReview 记录时补建一条已通过的记录（初审标记 SKIPPED）
 * - Teacher.status 非 COMPLETED/UNLOCKED 时归正为 COMPLETED，并清除永久拒绝标记
 * - 直接邀请/间接邀请记录置为 VALID
 */
export async function directApproveTeacher(
  teacherId: string,
  note?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const adminSession = await getSuperAdminSession()
    const operatorSession = adminSession ? null : await getOperatorSession()
    if (!adminSession && !operatorSession) {
      return { success: false, error: '无权限执行此操作' }
    }

    let reviewerLabel = adminSession?.reviewerLabel ?? ''
    if (operatorSession) {
      const operator = await prisma.operator.findUnique({
        where: { id: operatorSession.operatorId },
        select: { role: true, isEnabled: true },
      })
      if (!operator || !operator.isEnabled || operator.role !== 'OPERATOR') {
        return { success: false, error: '仅管理员或运营可执行直接通过' }
      }
      reviewerLabel = operatorSession.name
    }

    const teacher = await prisma.teacher.findUnique({
      where: { id: teacherId },
      select: { id: true, status: true, permanentlyRejectedAt: true },
    })
    if (!teacher) return { success: false, error: '教练不存在' }

    const review = await prisma.coachReview.findUnique({
      where: { teacherId },
      select: { id: true, stage: true, firstReviewVerdict: true },
    })

    const now = new Date()
    const trimmedNote = note?.trim() || undefined

    await prisma.$transaction(async (tx) => {
      if (review) {
        if (review.stage !== 'APPROVED') {
          await tx.coachReview.update({
            where: { id: review.id },
            data: {
              ...(review.firstReviewVerdict === 'PENDING'
                ? { firstReviewVerdict: 'SKIPPED' as const }
                : {}),
              ...(operatorSession
                ? { finalReviewOperatorId: operatorSession.operatorId }
                : {}),
              finalReviewVerdict: 'APPROVED',
              finalReviewedBy: reviewerLabel,
              finalReviewedAt: now,
              finalReviewNote: trimmedNote,
              stage: 'APPROVED',
            },
          })
        }
      } else {
        await tx.coachReview.create({
          data: {
            teacherId,
            firstReviewVerdict: 'SKIPPED',
            ...(operatorSession
              ? { finalReviewOperatorId: operatorSession.operatorId }
              : {}),
            finalReviewVerdict: 'APPROVED',
            finalReviewedBy: reviewerLabel,
            finalReviewedAt: now,
            finalReviewNote: trimmedNote,
            stage: 'APPROVED',
          },
        })
      }

      if (teacher.status !== 'COMPLETED' && teacher.status !== 'UNLOCKED') {
        await tx.teacher.update({
          where: { id: teacherId },
          data: { status: 'COMPLETED' },
        })
      }

      if (teacher.permanentlyRejectedAt) {
        await tx.teacher.update({
          where: { id: teacherId },
          data: {
            permanentlyRejectedAt: null,
            permanentlyRejectedBy: null,
          },
        })
      }
    })

    await markReferralStatus(teacherId, 'VALID')

    await recordAudit({
      actorType: operatorSession ? 'OPERATOR' : 'ADMIN',
      actorId: operatorSession?.operatorId ?? 'super_admin',
      actorName: reviewerLabel,
      action: 'DIRECT_APPROVE',
      targetType: 'TEACHER',
      targetId: teacherId,
      detail: {
        note: trimmedNote ?? null,
        fromTeacherStatus: teacher.status,
        hadCoachReview: Boolean(review),
      },
    })

    revalidatePath('/admin/teachers')
    revalidatePath(`/admin/teachers/${teacherId}`)
    revalidatePath('/onboarding')
    revalidatePath('/onboarding/complete')
    revalidatePath('/admin/referrals')

    return { success: true }
  } catch (error) {
    console.error('直接通过失败:', error)
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
    // 批量复审仅限超管：运营即使获得复审权限，也只能逐条复审（批量通过/批量驳回风险高，不开放）
    const finalReviewSession = await getFinalReviewSession()
    if (!finalReviewSession || finalReviewSession.operatorId !== null) {
      return { success: false, results }
    }
    const reviewerLabel = finalReviewSession.reviewerLabel

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
              finalReviewedBy: reviewerLabel,
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
              finalReviewedBy: reviewerLabel,
              finalReviewedAt: new Date(),
              finalReviewNote: trimmedNote!,
              stage: 'REJECTED',
            },
          })
          await markReferralStatus(
            teacherId,
            'INVALID',
            trimmedNote,
            reviewerLabel
          )
        }

        await recordAudit({
          actorType: finalReviewSession.operatorId ? 'OPERATOR' : 'ADMIN',
          actorId: finalReviewSession.operatorId ?? 'super_admin',
          actorName: finalReviewSession.operatorId ? reviewerLabel : '管理员',
          action: 'FINAL_REVIEW',
          targetType: 'TEACHER',
          targetId: teacherId,
          detail: { decision: verdict, mode: 'batch' },
        })

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

const CHALLENGEABLE_TYPES = ['GAOKAO_SCORE', 'DEGREE_CERT', 'TEACHER_CERT', 'MANDARIN_CERT']

function parseChallengeItems(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((v): v is string => typeof v === 'string')
}

/**
 * 质疑取证：初审人（学管/运营）或复审人（运营/超管）对数据存疑时打回，
 * 教练按要求补交证明后重新提交，回到发起质疑的阶段由原审核人继续审。
 */
export async function challengeCoachReview(
  reviewId: string,
  items: string[],
  note?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const normalizedItems = Array.from(new Set((items ?? []).map((t) => String(t).trim()).filter(Boolean)))
    if (!normalizedItems.includes('GAOKAO_SCORE')) {
      return { success: false, error: '质疑取证必须包含「高考成绩查询结果」' }
    }
    if (normalizedItems.some((t) => !CHALLENGEABLE_TYPES.includes(t))) {
      return { success: false, error: '包含不支持的证明类型' }
    }
    const trimmedNote = note?.trim()
    if (!trimmedNote) {
      return { success: false, error: '请填写质疑说明（将展示给教练）' }
    }

    const review = await prisma.coachReview.findUnique({
      where: { id: reviewId },
      select: {
        id: true,
        teacherId: true,
        stage: true,
        firstReviewVerdict: true,
        finalReviewVerdict: true,
        firstReviewOperatorId: true,
        finalReviewOperatorId: true,
      },
    })
    if (!review) return { success: false, error: '审核记录不存在' }

    let challengeFromStage: 'FIRST_REVIEW' | 'FINAL_REVIEW'
    let actorType: 'OPERATOR' | 'ADMIN'
    let actorId: string
    let actorName: string

    if (review.stage === 'FIRST_REVIEW') {
      const operatorSession = await getOperatorSession()
      if (!operatorSession || operatorSession.operatorId !== review.firstReviewOperatorId) {
        return { success: false, error: '仅该教练的初审人可发起质疑取证' }
      }
      if (review.firstReviewVerdict !== 'PENDING') {
        return { success: false, error: '初审已完成' }
      }
      challengeFromStage = 'FIRST_REVIEW'
      actorType = 'OPERATOR'
      actorId = operatorSession.operatorId
      actorName = operatorSession.name
    } else if (review.stage === 'FINAL_REVIEW') {
      const finalReviewSession = await getFinalReviewSession(review)
      if (!finalReviewSession) {
        return { success: false, error: '无权限，复审质疑仅限超管、被分配的复审人或已授权的运营' }
      }
      if (review.finalReviewVerdict !== 'PENDING') {
        return { success: false, error: '复审已完成' }
      }
      challengeFromStage = 'FINAL_REVIEW'
      actorType = finalReviewSession.operatorId ? 'OPERATOR' : 'ADMIN'
      actorId = finalReviewSession.operatorId ?? 'super_admin'
      actorName = finalReviewSession.operatorId ? finalReviewSession.reviewerLabel : '管理员'
    } else {
      return { success: false, error: '该记录当前不可发起质疑取证' }
    }

    const result = await prisma.coachReview.updateMany({
      where: { id: reviewId, stage: review.stage },
      data: {
        stage: 'CHALLENGED',
        challengeFromStage,
        challengeItems: normalizedItems as never,
        challengeNote: trimmedNote,
        challengedById: actorId,
        challengedByName: actorName,
        challengedAt: new Date(),
      },
    })
    if (result.count !== 1) {
      return { success: false, error: '该记录已被处理，请刷新后重试' }
    }

    await recordAudit({
      actorType,
      actorId,
      actorName,
      action: 'CHALLENGE_COACH_REVIEW',
      targetType: 'TEACHER',
      targetId: review.teacherId,
      detail: { items: normalizedItems, note: trimmedNote, fromStage: review.stage },
    })

    revalidatePath('/admin/teachers')
    revalidatePath(`/admin/teachers/${review.teacherId}`)
    revalidatePath('/onboarding')
    return { success: true }
  } catch (error) {
    console.error('质疑取证打回失败:', error)
    return { success: false, error: '操作失败，请重试' }
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
      select: {
        id: true,
        stage: true,
        challengeFromStage: true,
        challengeItems: true,
        challengedAt: true,
      },
    })

    if (!review) return { success: false, error: '审核记录不存在' }

    // 质疑取证补证后重新提交：必须补齐全部要求项，且回到发起质疑的阶段
    if (review.stage === 'CHALLENGED') {
      if (!review.challengedAt) {
        return { success: false, error: '质疑记录异常，请联系运营处理' }
      }
      const requiredTypes = parseChallengeItems(review.challengeItems)
      if (requiredTypes.length === 0) {
        return { success: false, error: '质疑要求清单异常，请联系运营处理' }
      }

      const missingTypes: string[] = []
      for (const type of requiredTypes) {
        const count = await prisma.teacherQualification.count({
          where: {
            teacherId,
            type: type as never,
            createdAt: { gt: review.challengedAt },
          },
        })
        if (count === 0) missingTypes.push(type)
      }
      if (missingTypes.length > 0) {
        const labels = missingTypes.map(
          (t) => QUALIFICATION_TYPE_LABELS[t as QualificationType] ?? t
        )
        return { success: false, error: `请先补交：${labels.join('、')}` }
      }

      const nextStage = review.challengeFromStage === 'FINAL_REVIEW' ? 'FINAL_REVIEW' : 'FIRST_REVIEW'
      await prisma.coachReview.update({
        where: { id: review.id },
        data: {
          stage: nextStage,
          // 初审质疑：初审人不变，仅重置结论待其复核
          ...(nextStage === 'FIRST_REVIEW'
            ? {
                firstReviewVerdict: 'PENDING' as const,
                firstReviewedBy: null,
                firstReviewedAt: null,
                firstReviewNote: null,
              }
            : {
                finalReviewVerdict: 'PENDING' as const,
                finalReviewedBy: null,
                finalReviewedAt: null,
                finalReviewNote: null,
              }),
          challengeFromStage: null,
          challengeItems: Prisma.JsonNull,
          challengeNote: null,
          challengedById: null,
          challengedByName: null,
          challengedAt: null,
          attemptCount: { increment: 1 },
        },
      })

      const reviewRecord = await prisma.coachReview.findUnique({
        where: { id: review.id },
        select: { teacher: { select: { name: true } } },
      })

      await recordAudit({
        actorType: 'TEACHER',
        actorId: teacherId,
        actorName: reviewRecord?.teacher.name ?? null,
        action: 'RESUBMIT_COACH_REVIEW',
        targetType: 'TEACHER',
        targetId: teacherId,
        detail: { mode: 'CHALLENGE', nextStage },
      })

      revalidatePath('/onboarding')
      revalidatePath('/onboarding/complete')
      revalidatePath('/admin/teachers')
      revalidatePath(`/admin/teachers/${teacherId}`)

      return { success: true }
    }

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

export type CoachReviewChallenge = {
  note: string
  items: string[]
  challengedByName: string | null
  challengedAt: Date
  attemptCount: number
}

/** 教练端：质疑取证要求（stage = CHALLENGED 时返回） */
export async function getCoachReviewChallenge(
  teacherId: string
): Promise<CoachReviewChallenge | null> {
  try {
    const review = await prisma.coachReview.findUnique({
      where: { teacherId },
      select: {
        stage: true,
        challengeNote: true,
        challengeItems: true,
        challengedByName: true,
        challengedAt: true,
        attemptCount: true,
      },
    })
    if (!review || review.stage !== 'CHALLENGED' || !review.challengedAt) return null
    return {
      note: review.challengeNote ?? '',
      items: parseChallengeItems(review.challengeItems),
      challengedByName: review.challengedByName,
      challengedAt: review.challengedAt,
      attemptCount: review.attemptCount,
    }
  } catch (error) {
    console.error('查询质疑取证要求失败:', error)
    return null
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

export async function updateFirstReviewer(
  teacherId: string,
  operatorId: string | null
): Promise<{ success: boolean; error?: string }> {
  try {
    const adminSession = await getSuperAdminSession()
    if (!adminSession) {
      return { success: false, error: '无权限，仅超管可修改初审负责人' }
    }

    const review = await prisma.coachReview.findUnique({
      where: { teacherId },
      select: { id: true, firstReviewVerdict: true },
    })

    if (!review) return { success: false, error: '审核记录不存在' }

    await prisma.coachReview.update({
      where: { id: review.id },
      data: { firstReviewOperatorId: operatorId },
    })

    // 同步更新跟进人：指定运营则覆盖/新建，设为 null（合并审核）则不动跟进人
    if (operatorId) {
      await prisma.teacherTeam.upsert({
        where: { teacherId },
        update: { operatorId },
        create: { teacherId, operatorId },
      })
    }

    revalidatePath('/admin/teachers')
    revalidatePath(`/admin/teachers/${teacherId}`)
    revalidatePath('/onboarding')
    revalidatePath('/onboarding/complete')

    return { success: true }
  } catch (error) {
    console.error('修改初审负责人失败:', error)
    return { success: false, error: '操作失败，请重试' }
  }
}
