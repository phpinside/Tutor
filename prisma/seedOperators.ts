import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

// 测试学管账号（密码统一为 123456）
const TEST_OPERATORS = [
  {
    name: '张伟',
    phone: '13800000010',
    remarks: '华东大区负责人',
    wechatQrCode: null,
    isEnabled: true,
  },
  {
    name: '李娜',
    phone: '13800000011',
    remarks: '负责新教练初审',
    wechatQrCode: null,
    isEnabled: true,
  },
  {
    name: '王芳',
    phone: '13800000012',
    remarks: '学习规划师评审',
    wechatQrCode: null,
    isEnabled: true,
  },
  {
    name: '刘洋',
    phone: '13800000013',
    remarks: null,
    wechatQrCode: null,
    isEnabled: true,
  },
  {
    name: '陈静',
    phone: '13800000014',
    remarks: '实习生（试用中）',
    wechatQrCode: null,
    isEnabled: true,
  },
  {
    name: '赵磊',
    phone: '13800000015',
    remarks: '已离职，账号已禁用',
    wechatQrCode: null,
    isEnabled: false,
  },
]

async function main() {
  console.log('开始创建学管（运营人员）测试数据...\n')

  const hashedPw = await bcrypt.hash('123456', 10)
  const created: { name: string; phone: string; isEnabled: boolean }[] = []

  for (const op of TEST_OPERATORS) {
    const operator = await prisma.operator.upsert({
      where: { phone: op.phone },
      update: {
        name: op.name,
        password: hashedPw,
        isEnabled: op.isEnabled,
        remarks: op.remarks,
      },
      create: {
        name: op.name,
        phone: op.phone,
        password: hashedPw,
        isEnabled: op.isEnabled,
        remarks: op.remarks,
        wechatQrCode: op.wechatQrCode,
      },
    })

    const status = operator.isEnabled ? '启用' : '禁用'
    console.log(`  ✓ ${operator.name} | ${operator.phone} | ${status}`)
    created.push({ name: operator.name, phone: operator.phone, isEnabled: operator.isEnabled })
  }

  // 将 seedTestData 中已有的教练（13900000010X）分配给前几位学管，便于测试团队管理
  const teachers = await prisma.teacher.findMany({
    where: { phone: { startsWith: '1390000001' } },
    select: { id: true, name: true },
  })

  if (teachers.length > 0) {
    const enabledOps = created.filter(o => o.isEnabled)
    let i = 0
    for (const teacher of teachers) {
      const op = enabledOps[i % enabledOps.length]
      const operator = await prisma.operator.findUnique({ where: { phone: op.phone } })
      if (!operator) continue
      await prisma.teacherTeam.upsert({
        where: { teacherId: teacher.id },
        update: { operatorId: operator.id },
        create: { teacherId: teacher.id, operatorId: operator.id },
      })
      i++
    }
    console.log(`\n  ✓ 已将 ${teachers.length} 位教练分配给学管（轮询分配）`)
  }

  console.log('\n=== 学管测试数据创建完成 ===')
  console.log('\n【学管登录】入口: /operator/login  统一密码: 123456')
  console.log('─'.repeat(52))
  for (const op of created) {
    const tag = op.isEnabled ? '' : ' (已禁用)'
    console.log(`  ${op.name.padEnd(4)} ${op.phone}${tag}`)
  }
  console.log('\n【超级管理员登录】入口: /admin/login')
  console.log('  用户名: admin')
  console.log('  密码:   admin123')
}

main()
  .catch((e) => {
    console.error('创建失败:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
