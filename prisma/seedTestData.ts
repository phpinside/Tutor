import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('开始创建测试数据...')

  // 1. 创建运营人员（初审人）
  const hashedPw = await bcrypt.hash('123456', 10)
  const operator = await prisma.operator.upsert({
    where: { phone: '13800000001' },
    update: {},
    create: {
      name: '测试运营',
      phone: '13800000001',
      password: hashedPw,
    },
  })
  console.log(`运营人员: ${operator.name} (${operator.id})`)

  // 2. 创建邀请人（老教练）
  const referrerPw = await bcrypt.hash('123456', 10)
  const referrer = await prisma.teacher.upsert({
    where: { phone: '13900000000' },
    update: {},
    create: {
      name: '测试邀请人',
      phone: '13900000000',
      password: referrerPw,
      inviteCode: 'TESTREF',
      status: 'UNLOCKED',
      currentTaskIndex: 7,
      subjects: ['MATH'],
    },
  })
  console.log(`邀请人: ${referrer.name} (${referrer.id})`)

  // 3. 创建 8 个被邀请教练（COMPLETED + 2025-06-01 后注册）
  const batchSize = 8
  for (let i = 1; i <= batchSize; i++) {
    const phone = `1390000001${i.toString().padStart(2, '0')}`
    const teacherPw = await bcrypt.hash('123456', 10)

    const teacher = await prisma.teacher.upsert({
      where: { phone },
      update: {},
      create: {
        name: `测试教练${i}`,
        phone,
        password: teacherPw,
        inviteCode: `TEST0${i}`,
        status: 'COMPLETED',
        currentTaskIndex: 7,
        subjects: ['MATH'],
        createdAt: new Date('2025-06-15'),
        invitedById: referrer.id,
      },
    })

    // 4. 创建 DIRECT 邀请记录（PENDING）
    const referral = await prisma.referral.findFirst({
      where: { referrerId: referrer.id, referredId: teacher.id, type: 'DIRECT' },
    })
    if (!referral) {
      await prisma.referral.create({
        data: {
          referrerId: referrer.id,
          referredId: teacher.id,
          type: 'DIRECT',
          status: 'PENDING',
        },
      })
    }

    // 5. 创建 CoachReview（FINAL_REVIEW 阶段，已初审通过）
    const existingReview = await prisma.coachReview.findUnique({
      where: { teacherId: teacher.id },
    })
    if (!existingReview) {
      await prisma.coachReview.create({
        data: {
          teacherId: teacher.id,
          firstReviewOperatorId: operator.id,
          firstReviewVerdict: 'APPROVED',
          firstReviewedBy: '测试运营',
          firstReviewedAt: new Date(),
          finalReviewVerdict: 'PENDING',
          stage: 'FINAL_REVIEW',
          resolveSource: 'api',
        },
      })
    }

    console.log(`  ✓ 教练${i}: ${teacher.name} (${teacher.id.substring(0, 8)}...) → 待复审`)
  }

  // 额外造 2 个合并审核（firstReviewOperatorId = null）验证不会出现在批量列表
  for (let i = 9; i <= 10; i++) {
    const phone = `1390000001${i}`
    const teacherPw = await bcrypt.hash('123456', 10)
    const teacher = await prisma.teacher.upsert({
      where: { phone },
      update: {},
      create: {
        name: `合并审核教练${i}`,
        phone,
        password: teacherPw,
        inviteCode: `TEST0${i}`,
        status: 'COMPLETED',
        currentTaskIndex: 7,
        subjects: ['MATH'],
        createdAt: new Date('2025-06-15'),
        invitedById: referrer.id,
      },
    })

    const referral = await prisma.referral.findFirst({
      where: { referrerId: referrer.id, referredId: teacher.id, type: 'DIRECT' },
    })
    if (!referral) {
      await prisma.referral.create({
        data: {
          referrerId: referrer.id,
          referredId: teacher.id,
          type: 'DIRECT',
          status: 'PENDING',
        },
      })
    }

    const existingReview = await prisma.coachReview.findUnique({
      where: { teacherId: teacher.id },
    })
    if (!existingReview) {
      await prisma.coachReview.create({
        data: {
          teacherId: teacher.id,
          firstReviewOperatorId: null,
          finalReviewVerdict: 'PENDING',
          stage: 'FINAL_REVIEW',
          resolveSource: 'merged',
        },
      })
    }

    console.log(`  ✓ 合并教练${i}: ${teacher.name} → 待审核（不应出现在批量列表）`)
  }

  console.log('\n=== 测试数据创建完成 ===')
  console.log('超管登录: admin / admin123')
  console.log('运营登录: 13800000001 / 123456')
  console.log('邀请人登录: 13900000000 / 123456')
  console.log('教练登录: 13900000010X / 123456')
  console.log('\n待复审（两级流程）: 教练 1-8（可批量操作）')
  console.log('待审核（合并流程）: 教练 9-10（不可批量操作，无 checkbox）')
}

main()
  .catch((e) => {
    console.error('创建失败:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
