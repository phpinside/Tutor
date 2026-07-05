import { PrismaClient } from '@prisma/client'
import { resolveFirstReviewer, REVIEW_ELIGIBLE_SINCE } from '../src/lib/externalTutor'

const prisma = new PrismaClient()

async function main() {
  console.log('开始回填 CoachReview 记录...')

  // 查找符合条件的教练：COMPLETED + 2025-06-01 后注册 + 有 PENDING 直接邀请
  const candidates = await prisma.teacher.findMany({
    where: {
      status: 'COMPLETED',
      createdAt: { gte: REVIEW_ELIGIBLE_SINCE },
      referredReferrals: {
        some: { type: 'DIRECT', status: 'PENDING' },
      },
    },
    select: { id: true, name: true, createdAt: true },
  })

  console.log(`找到 ${candidates.length} 个符合条件的教练`)

  let created = 0
  let skipped = 0

  for (const teacher of candidates) {
    // 跳过已有 CoachReview 的
    const existing = await prisma.coachReview.findUnique({
      where: { teacherId: teacher.id },
      select: { id: true },
    })
    if (existing) {
      skipped++
      continue
    }

    // 查找直接邀请记录及邀请人手机号
    const directReferral = await prisma.referral.findFirst({
      where: {
        referredId: teacher.id,
        type: 'DIRECT',
        status: 'PENDING',
      },
      select: {
        id: true,
        referrerId: true,
        referrer: { select: { phone: true } },
      },
    })

    if (!directReferral) {
      skipped++
      continue
    }

    const inviterPhone = directReferral.referrer?.phone ?? null
    const resolved = await resolveFirstReviewer(inviterPhone)

    await prisma.coachReview.create({
      data: {
        teacherId: teacher.id,
        firstReviewOperatorId: resolved.operatorId,
        resolvedManagerPhone: resolved.managerPhone,
        resolveSource: resolved.source,
        stage: 'FIRST_REVIEW',
      },
    })

    created++
    console.log(
      `  ✓ ${teacher.name || teacher.id} → ${
        resolved.operatorId ? '两级审核' : '合并审核'
      }`
    )
  }

  // 处理已 VALID 的邀请（历史已审核数据）
  const alreadyValidTeachers = await prisma.teacher.findMany({
    where: {
      status: 'COMPLETED',
      createdAt: { gte: REVIEW_ELIGIBLE_SINCE },
      referredReferrals: {
        some: { type: 'DIRECT', status: 'VALID' },
      },
    },
    select: { id: true, name: true },
  })

  console.log(
    `\n找到 ${alreadyValidTeachers.length} 个已审核通过(VALID)的教练，标记为 APPROVED`
  )

  let approvedCreated = 0
  for (const teacher of alreadyValidTeachers) {
    const existing = await prisma.coachReview.findUnique({
      where: { teacherId: teacher.id },
      select: { id: true },
    })
    if (existing) continue

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
  }

  console.log(`\n=== 回填完成 ===`)
  console.log(`新创建待审核: ${created}`)
  console.log(`已审核标记 APPROVED: ${approvedCreated}`)
  console.log(`跳过（已有记录/不符合条件）: ${skipped}`)
}

main()
  .catch((e) => {
    console.error('回填失败:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
