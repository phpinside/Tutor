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

// 格式化姓名为"姓xx"格式
export function formatName(name: string | null): string {
  if (!name || name.length <= 1) return name || ''
  return name.charAt(0) + 'xx'
}

// 格式化手机号为脱敏展示：11 位国内号前 3 + **** + 后 4；其他长度对数字部分做保守掩码
export function formatPhone(phone: string | null): string {
  if (!phone) return ''
  const digits = phone.replace(/\D/g, '')
  if (digits.length === 11) {
    return digits.substring(0, 3) + '****' + digits.substring(7)
  }
  if (digits.length === 0) return ''
  if (digits.length < 4) return '****'
  if (digits.length <= 6) {
    return digits[0] + '****' + digits[digits.length - 1]
  }
  return digits.substring(0, 2) + '****' + digits.substring(digits.length - 2)
}

// 格式化日期时间为中国时区，格式：2026/1/8 22点28分
export function formatDateTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  
  // 使用中国时区格式化
  const formatted = d.toLocaleString('zh-CN', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  })
  
  // 转换格式：从 "2026/1/8 22:28" 到 "2026/1/8 22点28分"
  const [datePart, timePart] = formatted.split(' ')
  const [hour, minute] = timePart.split(':')
  return `${datePart} ${hour}:${minute}`
}
