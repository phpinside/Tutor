import { prisma } from '@/lib/prisma'
import { cache } from 'react'

// 系统级常量：当前启用的任务总数
export const TOTAL_TASK_COUNT = 7

// 任务索引从 0 开始，最后一个任务索引为 6
export const LAST_TASK_INDEX = TOTAL_TASK_COUNT - 1

// 在线测试题目类型定义
export interface TestQuestion {
  id: string
  type: 'SINGLE' | 'MULTIPLE'
  question: string
  options: string[]
  answer: string[]
}

// 任务配置类型定义
export interface TaskConfig {
  index: number
  title: string
  phase: number
  emoji: string
  type: string
  description: string
  estimatedMinutes: number
  isOptional?: boolean
  requirements: string[]
  questions?: TestQuestion[]
}

export interface PhaseConfig {
  phase: number
  title: string
  description: string
  taskIndices: number[]
}

// 从数据库获取任务配置（缓存版本）
export const getTaskConfigs = cache(async (): Promise<TaskConfig[]> => {
  const dbConfigs = await prisma.taskConfig.findMany({
    where: { isActive: true },
    orderBy: [
      { sortOrder: 'asc' },
      { index: 'asc' }
    ]
  })
  
  return dbConfigs.map(config => ({
    index: config.index,
    title: config.title,
    phase: config.phase,
    emoji: config.emoji,
    type: config.type,
    description: config.description,
    estimatedMinutes: config.estimatedMinutes,
    isOptional: config.isOptional,
    requirements: config.requirements as string[],
    questions: config.questions ? (config.questions as unknown as TestQuestion[]) : undefined
  }))
})

// 从数据库获取阶段配置（缓存版本）
export const getPhaseConfigs = cache(async (): Promise<PhaseConfig[]> => {
  const dbConfigs = await prisma.phaseConfig.findMany({
    where: { isActive: true },
    orderBy: [
      { sortOrder: 'asc' },
      { phase: 'asc' }
    ]
  })
  
  const taskConfigs = await getTaskConfigs()
  
  return dbConfigs.map(config => ({
    phase: config.phase,
    title: config.title,
    description: config.description,
    taskIndices: taskConfigs
      .filter(t => t.phase === config.phase)
      .map(t => t.index)
  }))
})

// 获取任务所在阶段
export async function getTaskPhase(taskIndex: number): Promise<number> {
  const tasks = await getTaskConfigs()
  const task = tasks.find(t => t.index === taskIndex)
  return task?.phase || 1
}

// 获取阶段的所有任务
export async function getPhaseTaskIndices(phase: number): Promise<number[]> {
  const phases = await getPhaseConfigs()
  const phaseConfig = phases.find(p => p.phase === phase)
  return phaseConfig?.taskIndices || []
}

// 计算总进度
export async function calculateProgress(currentTaskIndex: number): Promise<number> {
  const tasks = await getTaskConfigs()
  const totalTasks = tasks.length
  return Math.round((currentTaskIndex / totalTasks) * 100)
}

// 七牛云配置（从环境变量读取）
export const QINIU_CONFIG = {
  accessKey: process.env.QINIU_ACCESS_KEY || '',
  secretKey: process.env.QINIU_SECRET_KEY || '',
  bucket: 'tutor-onboarding',
  domain:  'https://cdn.bytemath.cn',
}

// 任务视频配置（支持单视频或多视频）
export interface VideoConfig {
  key: string // 七牛云上的文件路径
  title: string // 视频标题
  duration?: number // 视频时长（分钟）
}

export const TASK_VIDEOS: Record<number, VideoConfig[]> = {
  0: [ // 了解伴学兼职 - 单视频
    {
      key: 'training-videos/task-0-intro.mp4',
      title: '伴学兼职介绍',
      duration: 16
    }
  ],
  3: [ // 伴学系统 - 多视频
    {
      key: 'training-videos/task-3-demo.mp4',
      title: '伴学系统操作演示',
      duration: 48
    },
    {
      key: 'training-videos/task-3-install.mp4',
      title: '安装伴学软件并体验',
      duration: 15
    },
    {
      key: 'training-videos/task-3-sop.mp4',
      title: '试听课SOP和正式课SOP',
      duration: 28
    }
  ],
  5: [ // 1v1群消息培训 - 多视频
    {
      key: 'training-videos/task-5-group.mp4',
      title: '1v1 家长群使用规范',
      duration: 10
    }
  ]
}

// Video upload configuration for tasks requiring video submissions
export interface VideoUploadConfig {
  key: string          // Unique identifier (e.g., 'intro', 'lecture', 'practice')
  title: string        // Display title (e.g., '自我介绍', '讲题体验')
  emoji?: string       // Optional emoji icon
  tips: string[]       // Shooting tips/guidelines
}

export const TASK_VIDEO_UPLOADS: Record<number, VideoUploadConfig[]> = {
  2: [ // Task 2: Dual video
    {
      key: 'intro',
      title: '自我介绍',
      emoji: '🎤',
      tips: [
        '真人出镜，介绍自己的基本情况（姓名、学校、专业）',
        '分享你的教学经验和优势',
        '时长约3分钟,自然清晰就好',
        '不看颜值,不背稿,看真实表达'
      ]
    },
    {
      key: 'lecture',
      title: '讲题体验',
      emoji: '📐',
      tips: [
        '选一道你熟悉的数学题进行讲解，可不出镜',
        '展示你的思路清晰和引导式教学能力',
        '时长约10分钟左右，确保声音清晰'
      ]
    }
  ],
  4: [ // Task 4: Single video
    {
      key: 'practice',
      title: '上传伴学系统操作视频',
      emoji: '💻',
      tips: [
        '请登录【鼎伴学】系统，将各个功能完整体验一遍，做到非常熟悉，这会直接影响后续接课与教学质量',
        '参考课程回放：https://meeting.tencent.com/crm/N1ERoG1L55',
        '参考上述上课流程，用腾讯会议录制一段试讲视频，可不出镜：',
        '时长：约 20 分钟',
        '内容：覆盖关键教学流程（如开场、讲解、互动、总结等）',
        '要求：流程完整、表达清晰、符合伴学课堂节奏',
        '校区账号：18701557327， 密码：123qwe',
        '用自己手机号从试课学员入口注册体验',

        '附：【鼎伴学软件】百度网盘下载: https://pan.baidu.com/s/1PIkrnWXPS-T-mI5iiIV6Fw?pwd=jvh9 提取码: jvh9',
        '下载完成，解压缩后，双击【鼎伴学(正式版).exe】安装即可',

      ]
    }
  ]
}
