import { type ClassValue, clsx } from 'clsx'

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs)
}

// 格式化时长
export function formatDuration(minutes: number): string {
  if (minutes < 60) {
    return `约 ${minutes} 分钟`
  }
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  return mins > 0 ? `约 ${hours} 小时 ${mins} 分钟` : `约 ${hours} 小时`
}

// 获取任务状态文案
export function getTaskStatusText(status: string): string {
  const statusMap: Record<string, string> = {
    NOT_STARTED: '未开始',
    IN_PROGRESS: '进行中',
    PENDING_FEEDBACK: '待反馈',
    COMPLETED: '已完成',
    NEEDS_REVISION: '需调整'
  }
  return statusMap[status] || status
}

// 获取任务状态颜色
export function getTaskStatusColor(status: string): string {
  const colorMap: Record<string, string> = {
    NOT_STARTED: 'badge-gray',
    IN_PROGRESS: 'badge-primary',
    PENDING_FEEDBACK: 'badge-warning',
    COMPLETED: 'badge-success',
    NEEDS_REVISION: 'badge-warning'
  }
  return colorMap[status] || 'badge-gray'
}

// 获取老师状态文案
export function getTeacherStatusText(status: string): string {
  const statusMap: Record<string, string> = {
    NOT_STARTED: '未开始',
    IN_PROGRESS: '引导中',
    PENDING_REVIEW: '待审核',
    COMPLETED: '已完成引导',
    UNLOCKED: '已解锁接单'
  }
  return statusMap[status] || status
}

