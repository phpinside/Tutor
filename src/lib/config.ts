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
  0: [ // 了解伴学兼职
    {
      key: 'training-videos/task-0-intro.mp4',
      title: '伴学兼职介绍',
      duration: 16
    }
  ],
  3: [ // 伴学教练必修（上）
    {
      key: 'training-videos/01-goals-and-values.mp4',
      title: '1. 伴学目标和价值观',
      duration: 13
    },
    {
      key: 'training-videos/02-01-lesson-prep.mp4',
      title: '2.1 如何充分的备课',
      duration: 12
    },
    {
      key: 'training-videos/02-02-guided-tutoring.mp4',
      title: '2.2 如何有效开展引导式伴学',
      duration: 26
    },
    {
      key: 'training-videos/02-03-trial-lesson-structure.mp4',
      title: '2.3 试听课的标准结构',
      duration: 20
    },
    {
      key: 'training-videos/02-04-formal-lesson-structure.mp4',
      title: '2.4 正式课的标准结构',
      duration: 16
    },
    {
      key: 'training-videos/02-05-post-lesson-feedback.mp4',
      title: '2.5 如何撰写课后反馈',
      duration: 6
    },
    {
      key: 'training-videos/02-06-07-homework.mp4',
      title: '2.6&2.7 布置和批改课后作业',
      duration: 16
    },
    {
      key: 'training-videos/02-08-learning-plan.mp4',
      title: '2.8 如何撰写学习规划书',
      duration: 10
    },
    {
      key: 'training-videos/02-09-getting-students.mp4',
      title: '2.9 如何获得源源不断的学生',
      duration: 12
    },
    {
      key: 'training-videos/03-01-teaching-conduct.mp4',
      title: '3.1 教学基本行为规范',
      duration: 5
    },
    {
      key: 'training-videos/03-02-software-guide.mp4',
      title: '3.2 教学系统与软件使用规范',
      duration: 35
    },
  ],
  5: [ // 伴学教练必修（下）
    {
      key: 'training-videos/03-03-parent-communication.mp4',
      title: '3.3 家长沟通与群管理规范',
      duration: 9
    },
    {
      key: 'training-videos/03-04-scheduling.mp4',
      title: '3.4 课时与排课制度',
      duration: 6
    },
    {
      key: 'training-videos/03-05-leave-reschedule.mp4',
      title: '3.5 请假与调课流程',
      duration: 5
    },
    {
      key: 'training-videos/03-06-student-handover.mp4',
      title: '3.6 学生交接流程',
      duration: 6
    },
    {
      key: 'training-videos/03-07-credit-system.mp4',
      title: '3.7 信用分制度',
      duration: 6
    },
    {
      key: 'training-videos/03-08-hourly-rate.mp4',
      title: '3.8 伴学教练课时费',
      duration: 4
    },
    {
      key: 'training-videos/03-09-incident-rules.mp4',
      title: '3.9 课程异常费用处理规则',
      duration: 2
    },
    {
      key: 'training-videos/04-learning-assessment.mp4',
      title: '4. 学习效果评估',
      duration: 5
    },
    {
      key: 'training-videos/05-team-structure.mp4',
      title: '5. 伴学团队体系',
      duration: 18
    },
    {
      key: 'training-videos/06-eduflow-guide.mp4',
      title: '6. Eduflow系统使用',
      duration: 12
    },
    {
      key: 'training-videos/07-task-checklist.mp4',
      title: '7. 最后的最后-任务清单',
      duration: 6
    },
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
        '校区账号：15099942178， 密码：123qwe',
        '用自己手机号从试课学员入口注册体验',

        '附：【鼎伴学软件】百度网盘下载: https://pan.baidu.com/s/10c1VjToMw5Fvq0Kj39PPkw?pwd=gebd 提取码: gebd ',
        '下载完成，解压缩后，双击【鼎伴学(正式版).exe】安装即可',

      ]
    }
  ]
}

// 学科标签映射
const SUBJECT_LABELS: Record<string, string> = {
  MATH: '数学',
  PHYSICS: '物理',
  CHEMISTRY: '化学',
}

/**
 * 返回按最擅长学科定制后的视频上传配置。
 * 若 primarySubject 为空则回退通用文案（兼容老数据）。
 */
export function getTaskVideoUploadConfigs(
  taskIndex: number,
  primarySubject?: string | null
): VideoUploadConfig[] {
  const base = TASK_VIDEO_UPLOADS[taskIndex]
  if (!base) return []

  const subjectLabel = primarySubject ? (SUBJECT_LABELS[primarySubject] ?? '') : ''

  if (taskIndex === 2 && subjectLabel) {
    return base.map(config => {
      if (config.key === 'intro') {
        return {
          ...config,
          tips: [
            '真人出镜，介绍自己的基本情况（姓名、学校、专业）',
            `分享你的${subjectLabel}教学经验和优势`,
            '时长约3分钟,自然清晰就好',
            '不看颜值,不背稿,看真实表达'
          ]
        }
      }
      if (config.key === 'lecture') {
        return {
          ...config,
          title: `讲题体验（${subjectLabel}）`,
          tips: [
            `选一道你熟悉的${subjectLabel}题进行讲解，可不出镜`,
            '展示你的思路清晰和引导式教学能力',
            '时长约10分钟左右，确保声音清晰'
          ]
        }
      }
      return config
    })
  }

  if (taskIndex === 4 && subjectLabel) {
    return base.map(config => {
      if (config.key === 'practice') {
        return {
          ...config,
          title: `上传${subjectLabel}试讲视频`,
          tips: [
            `试讲内容为${subjectLabel}学科，请选取你最擅长的知识点进行演示`,
            '请登录【鼎伴学】系统，将各个功能完整体验一遍，做到非常熟悉，这会直接影响后续接课与教学质量',
            '参考课程回放：https://meeting.tencent.com/crm/N1ERoG1L55',
            '参考上述上课流程，用腾讯会议录制一段试讲视频，可不出镜：',
            '时长：约 20 分钟',
            '内容：覆盖关键教学流程（如开场、讲解、互动、总结等）',
            '要求：流程完整、表达清晰、符合伴学课堂节奏',
            '校区账号：15099942178， 密码：123qwe',
            '用自己手机号从试课学员入口注册体验',
            '附：【鼎伴学软件】百度网盘下载: https://pan.baidu.com/s/10c1VjToMw5Fvq0Kj39PPkw?pwd=gebd 提取码: gebd ',
            '下载完成，解压缩后，双击【鼎伴学(正式版).exe】安装即可',
          ]
        }
      }
      return config
    })
  }

  return base
}
