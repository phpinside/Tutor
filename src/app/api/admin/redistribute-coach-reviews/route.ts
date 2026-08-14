import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { prisma } from '@/lib/prisma'
import {
  resolveFirstReviewerWithFallback,
  REVIEW_ELIGIBLE_SINCE,
} from '@/lib/externalTutor'

export async function POST() {
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
    before: string
    after: string
  }[] = []

  try {
    // 查找所有待初审（FIRST_REVIEW + PENDING）且教练注册于 2025-06-01 后的记录
    const reviews = await prisma.coachReview.findMany({
      where: {
        stage: 'FIRST_REVIEW',
        firstReviewVerdict: 'PENDING',
        finalReviewVerdict: 'PENDING',
        teacher: {
          createdAt: { gte: REVIEW_ELIGIBLE_SINCE },
        },
      },
      select: {
        id: true,
        teacherId: true,
        firstReviewOperatorId: true,
        teacher: { select: { name: true } },
      },
    })

    let updated = 0
    let unchanged = 0

    for (const review of reviews) {
      // 查邀请人手机号
      const directReferral = await prisma.referral.findFirst({
        where: {
          referredId: review.teacherId,
          type: 'DIRECT',
        },
        select: {
          referrer: { select: { phone: true } },
        },
      })

      const inviterPhone = directReferral?.referrer?.phone ?? null
      const resolved = await resolveFirstReviewerWithFallback(review.teacherId, inviterPhone)

      const beforeOp = review.firstReviewOperatorId || '合并审核'
      const afterOp = resolved.operatorId || '合并审核'

      if (beforeOp === afterOp) {
        unchanged++
        continue
      }

      await prisma.coachReview.update({
        where: { id: review.id },
        data: {
          firstReviewOperatorId: resolved.operatorId,
          resolvedManagerPhone: resolved.managerPhone,
          resolveSource: resolved.source,
        },
      })

      // 仅当无人跟进时，将跟进人设为初审负责人（已有跟进人则跳过）
      if (resolved.operatorId) {
        await prisma.teacherTeam.createMany({
          data: [{ teacherId: review.teacherId, operatorId: resolved.operatorId }],
          skipDuplicates: true,
        })
      }

      updated++
      details.push({
        teacherId: review.teacherId,
        name: review.teacher.name,
        before: beforeOp === '合并审核' ? '合并审核' : `Operator:${beforeOp.substring(0, 8)}`,
        after: afterOp === '合并审核' ? '合并审核' : `Operator:${afterOp.substring(0, 8)}`,
      })
    }

    return NextResponse.json({
      success: true,
      summary: {
        total: reviews.length,
        updated,
        unchanged,
      },
      details,
    })
  } catch (error) {
    console.error('重新分发 CoachReview 失败:', error)
    return NextResponse.json(
      { error: '重新分发失败', detail: String(error) },
      { status: 500 }
    )
  }
}
