import { prisma } from '@/lib/prisma'
import { cache } from 'react'

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
}

export interface PhaseConfig {
  phase: number
  title: string
  description: string
  taskIndices: number[]
}

// 从数据库获取任务配置（缓存版本）
export const getTaskConfigs = cache(async (): Promise<TaskConfig[]> => {
  try {
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
      requirements: config.requirements as string[]
    }))
  } catch (error) {
    console.error('从数据库获取任务配置失败,使用默认配置:', error)
    return TASKS_CONFIG_FALLBACK
  }
})

// 从数据库获取阶段配置（缓存版本）
export const getPhaseConfigs = cache(async (): Promise<PhaseConfig[]> => {
  try {
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
  } catch (error) {
    console.error('从数据库获取阶段配置失败,使用默认配置:', error)
    return PHASES_CONFIG_FALLBACK
  }
})

// 备用任务配置（数据库读取失败时使用）
const TASKS_CONFIG_FALLBACK: TaskConfig[] = [
  {
    index: 0,
    title: '了解伴学兼职',
    phase: 1,
    emoji: '📚',
    type: 'INFO',
    description: '通过短视频和图文了解伴学是什么,收入结构和时间安排',
    estimatedMinutes: 5,
    requirements: [
      '观看介绍视频',
      '了解伴学的工作内容和收入结构',
      '勾选"我已了解"'
    ]
  },
  {
    index: 1,
    title: '填写基本信息',
    phase: 1,
    emoji: '✍️',
    type: 'FORM',
    description: '让我们先认识一下你',
    estimatedMinutes: 3,
    requirements: [
      '填写姓名、学校和专业',
      '选择擅长年级',
      '填写可工作时间'
    ]
  },
  {
    index: 2,
    title: '自我介绍和讲题体验',
    phase: 2,
    emoji: '🎤',
    type: 'VIDEO_UPLOAD',
    description: '不看颜值,不背稿,看真实表达',
    estimatedMinutes: 15,
    requirements: [
      '录制自我介绍(3分钟左右)',
      '选一道自己熟悉的数学题讲解(10分钟左右)',
      '自然清晰就很好,不需要追求完美'
    ]
  },
  {
    index: 3,
    title: '伴学系统',
    phase: 2,
    emoji: '📖',
    type: 'TRAINING',
    description: '学习伴学方法论和服务规范',
    estimatedMinutes: 20,
    requirements: [
      '完整观看伴学方法论视频',
      '了解服务边界和禁止行为',
      '掌握引导式教学方法'
    ]
  },
  {
    index: 4,
    title: '系统上手练习',
    phase: 3,
    emoji: '💻',
    type: 'PRACTICE',
    description: '熟悉教学系统的核心功能',
    estimatedMinutes: 15,
    requirements: [
      '录制系统操作演示',
      '包含:学员注册、能力测评、知识点讲解',
      '包含:作业布置的完整流程'
    ]
  },
  {
    index: 5,
    title: '1v1群消息培训',
    phase: 3,
    emoji: '💬',
    type: 'TRAINING',
    description: '学习如何与家长和学员沟通',
    estimatedMinutes: 15,
    requirements: [
      '了解1v1群的作用和规则',
      '学习课前提醒和课后反馈',
      '掌握群名称规则和会议邀请'
    ]
  }
]

// 兼容性导出：同步版本（仅用于客户端组件）
export const TASKS_CONFIG = TASKS_CONFIG_FALLBACK

// 备用阶段配置（数据库读取失败时使用）
const PHASES_CONFIG_FALLBACK: PhaseConfig[] = [
  {
    phase: 1,
    title: '认识伴学',
    description: '了解伴学工作内容,判断是否适合',
    taskIndices: [0, 1]
  },
  {
    phase: 2,
    title: '体验任务',
    description: '通过轻量任务展示真实能力',
    taskIndices: [2, 3]
  },
  {
    phase: 3,
    title: '上岗准备',
    description: '确保会做、会用、不会犯错',
    taskIndices: [4, 5]
  }
]

// 兼容性导出
export const PHASES_CONFIG = PHASES_CONFIG_FALLBACK

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

// 七牛云配置
export const QINIU_CONFIG = {
  accessKey: 'OU1MwffbOZ6LdvsiBcM4SRi08VemgdFHwOUN1Sk_',  // 替换为你的七牛云 AccessKey
  secretKey: '9ar3VV-adMAvvHacOpJV5DnSWnOLGopGZ9V7fK0z',  // 替换为你的七牛云 SecretKey
  bucket: 'tutor-onboarding',          // 替换为你的存储空间名称
  domain: 'http://cdn.bytemath.cn' // 替换为你的 CDN 域名
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
      duration: 5
    }
  ],
  3: [ // 伴学系统 - 多视频
    {
      key: 'training-videos/task-3-training.mp4',
      title: '伴学方法论',
      duration: 8
    },
    {
      key: 'training-videos/task-3-training.mp4',
      title: '服务边界与禁止行为',
      duration: 6
    },
    {
      key: 'training-videos/task-3-training.mp4',
      title: '引导式教学方法',
      duration: 6
    }
  ],
  5: [ // 1v1群消息培训 - 多视频
    {
      key: 'training-videos/task-5-training.mp4',
      title: '1v1群的作用',
      duration: 5
    },
    {
      key: 'training-videos/task-5-training.mp4',
      title: '和家长沟通确定上课时间',
      duration: 4
    }
  ]
}

