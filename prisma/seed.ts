import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 开始填充数据...')

  // 清除现有数据
  await prisma.taskSubmission.deleteMany()
  await prisma.teacher.deleteMany()
  await prisma.taskConfig.deleteMany()
  await prisma.phaseConfig.deleteMany()

  // 填充阶段配置
  console.log('📊 填充阶段配置...')
  const phases = [
    {
      phase: 1,
      title: '认识伴学',
      description: '了解伴学工作内容,判断是否适合',
      sortOrder: 1
    },
    {
      phase: 2,
      title: '体验任务',
      description: '通过轻量任务展示真实能力',
      sortOrder: 2
    },
    {
      phase: 3,
      title: '上岗准备',
      description: '确保会做、会用、不会犯错',
      sortOrder: 3
    }
  ]

  for (const phase of phases) {
    await prisma.phaseConfig.create({
      data: phase
    })
  }
  console.log(`✅ 已创建 ${phases.length} 个阶段配置`)

  // 填充任务配置
  console.log('📝 填充任务配置...')
  const tasks = [
    {
      index: 0,
      title: '了解伴学兼职',
      phase: 1,
      emoji: '📚',
      type: 'INFO',
      description: '通过短视频和图文了解伴学是什么,收入结构和时间安排',
      estimatedMinutes: 5,
      isOptional: false,
      requirements: ['观看介绍视频', '了解伴学的工作内容和收入结构', '勾选"我已了解"'],
      sortOrder: 0
    },
    {
      index: 1,
      title: '填写基本信息',
      phase: 1,
      emoji: '✍️',
      type: 'FORM',
      description: '让我们先认识一下你',
      estimatedMinutes: 3,
      isOptional: false,
      requirements: ['填写姓名、学校和专业', '选择擅长年级', '填写可工作时间'],
      sortOrder: 1
    },
    {
      index: 2,
      title: '自我介绍和讲题体验',
      phase: 2,
      emoji: '🎤',
      type: 'VIDEO_UPLOAD',
      description: '不看颜值,不背稿,看真实表达',
      estimatedMinutes: 15,
      isOptional: false,
      requirements: ['录制自我介绍(3分钟左右)', '选一道自己熟悉的数学题讲解(10分钟左右)', '自然清晰就很好,不需要追求完美'],
      sortOrder: 2
    },
    {
      index: 3,
      title: '伴学系统',
      phase: 2,
      emoji: '📖',
      type: 'TRAINING',
      description: '学习伴学方法论和服务规范',
      estimatedMinutes: 20,
      isOptional: false,
      requirements: ['完整观看伴学方法论视频', '了解服务边界和禁止行为', '掌握引导式教学方法'],
      sortOrder: 3
    },
    {
      index: 4,
      title: '系统上手练习',
      phase: 3,
      emoji: '💻',
      type: 'PRACTICE',
      description: '熟悉教学系统的核心功能',
      estimatedMinutes: 15,
      isOptional: false,
      requirements: ['录制系统操作演示', '包含:学员注册、能力测评、知识点讲解', '包含:作业布置的完整流程'],
      sortOrder: 4
    },
    {
      index: 5,
      title: '1v1群消息培训',
      phase: 3,
      emoji: '💬',
      type: 'TRAINING',
      description: '学习如何与家长和学员沟通',
      estimatedMinutes: 15,
      isOptional: false,
      requirements: ['了解1v1群的作用和规则', '学习课前提醒和课后反馈', '掌握群名称规则和会议邀请'],
      sortOrder: 5
    }
  ]

  for (const task of tasks) {
    await prisma.taskConfig.create({
      data: task as any
    })
  }
  console.log(`✅ 已创建 ${tasks.length} 个任务配置`)

  // 创建测试老师账号
  const testTeacher = await prisma.teacher.create({
    data: {
      name: '测试老师',
      status: 'NOT_STARTED'
    }
  })

  console.log('✅ 数据库初始化完成!')
  console.log(`📍 测试老师 ID: ${testTeacher.id}`)
}

main()
  .catch((e) => {
    console.error('❌ 数据填充失败:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
