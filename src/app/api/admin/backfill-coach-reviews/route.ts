import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { prisma } from '@/lib/prisma'
import {
  resolveFirstReviewerWithFallback,
  REVIEW_ELIGIBLE_SINCE,
} from '@/lib/externalTutor'

export async function POST(request: Request) {
  const cookieStore = await cookies()
  const session = cookieStore.get('admin_session')

  if (!session) {
    return NextResponse.json({ error: '未登录' }, { status: 401 })
  }

  try {
    const data = JSON.parse(session.value)
    if (data.role !== 'super_admin') {
      return NextResponse.json({ error: '无权限，仅超管可执行' }, { status: 403 })
    }
  } catch {
    return NextResponse.json({ error: '会话无效' }, { status: 401 })
  }

  const details: {
    teacherId: string
    name: string | null
    result: string
  }[] = []

  try {
    // === 第一批：PENDING 直接邀请 → 创建待初审记录 ===
    const candidates = await prisma.teacher.findMany({
      where: {
        status: 'COMPLETED',
        createdAt: { gte: REVIEW_ELIGIBLE_SINCE },
        referredReferrals: {
          some: { type: 'DIRECT', status: 'PENDING' },
        },
      },
      select: { id: true, name: true },
    })

    let pendingCreated = 0
    let pendingSkipped = 0

    for (const teacher of candidates) {
      const existing = await prisma.coachReview.findUnique({
        where: { teacherId: teacher.id },
        select: { id: true },
      })
      if (existing) {
        pendingSkipped++
        continue
      }

      const directReferral = await prisma.referral.findFirst({
        where: {
          referredId: teacher.id,
          type: 'DIRECT',
          status: 'PENDING',
        },
        select: {
          referrerId: true,
          referrer: { select: { phone: true } },
        },
      })

      if (!directReferral) {
        pendingSkipped++
        continue
      }

      const inviterPhone = directReferral.referrer?.phone ?? null
      const resolved = await resolveFirstReviewerWithFallback(teacher.id, inviterPhone)

      await prisma.coachReview.create({
        data: {
          teacherId: teacher.id,
          firstReviewOperatorId: resolved.operatorId,
          resolvedManagerPhone: resolved.managerPhone,
          resolveSource: resolved.source,
          stage: 'FIRST_REVIEW',
        },
      })

      pendingCreated++
      details.push({
        teacherId: teacher.id,
        name: teacher.name,
        result: resolved.operatorId ? '两级审核' : '合并审核',
      })
    }

    // === 第二批：已 VALID 直接邀请 → 标记为 APPROVED ===
    const alreadyValid = await prisma.teacher.findMany({
      where: {
        status: 'COMPLETED',
        createdAt: { gte: REVIEW_ELIGIBLE_SINCE },
        referredReferrals: {
          some: { type: 'DIRECT', status: 'VALID' },
        },
      },
      select: { id: true, name: true },
    })

    let approvedCreated = 0
    let approvedSkipped = 0

    for (const teacher of alreadyValid) {
      const existing = await prisma.coachReview.findUnique({
        where: { teacherId: teacher.id },
        select: { id: true },
      })
      if (existing) {
        approvedSkipped++
        continue
      }

      await prisma.coachReview.create({
        data: {
          teacherId: teacher.id,
          firstReviewOperatorId: null,
          firstReviewVerdict: 'SKIPPED',
          finalReviewVerdict: 'APPROVED',
          finalReviewedBy: '回填',
          stage: 'APPROVED',
          resolveSource: 'merged',
        },
      })

      approvedCreated++
      details.push({
        teacherId: teacher.id,
        name: teacher.name,
        result: '已审核→APPROVED',
      })
    }

    return NextResponse.json({
      success: true,
      summary: {
        pendingCreated,
        pendingSkipped,
        approvedCreated,
        approvedSkipped,
      },
      details,
    })
  } catch (error) {
    console.error('回填 CoachReview 失败:', error)
    return NextResponse.json(
      { error: '回填失败', detail: String(error) },
      { status: 500 }
    )
  }
}
