export const LEARNING_PLANNER_TEMPLATE_URL =
  'https://fn73lnaiyt.feishu.cn/wiki/YNwowYJ3DiAL5ekBhNpcQYrznUd'

export const LEARNING_PLANNER_STUDENT_NAME = '王小华'
export const LEARNING_PLANNER_EXPECTED_PDF_NAME =
  `${LEARNING_PLANNER_STUDENT_NAME}-数学学习规划建议书.pdf`

export const LEARNING_PLANNER_STUDENT_PROFILE = [
  { label: '学生姓名', value: '王小华' },
  { label: '性别', value: '女' },
  { label: '年级', value: '初二' },
  { label: '所在地区', value: '北京市海淀区' },
  { label: '就读学校', value: '北京市第二中学' },
  { label: '数学当前成绩', value: '72分（满分100）' },
  { label: '学习进度', value: '初二数学知识点已学完' },
  { label: '其他学科平均成绩', value: '78分' },
  { label: '数学教材版本', value: '人教版' },
] as const

export function isLearningPlannerEligible(
  teacherStatus: string,
  currentTaskIndex: number,
  totalTaskCount: number
) {
  return (
    teacherStatus === 'COMPLETED' ||
    teacherStatus === 'UNLOCKED' ||
    currentTaskIndex >= totalTaskCount
  )
}

export function getLearningPlannerStatusText(status: string) {
  const statusMap: Record<string, string> = {
    PENDING: '待审核',
    APPROVED: '已通过',
    REJECTED: '未通过',
  }

  return statusMap[status] || status
}

export function getLearningPlannerStatusBadgeClass(status: string) {
  const statusMap: Record<string, string> = {
    PENDING: 'badge-warning',
    APPROVED: 'badge-success',
    REJECTED: 'bg-red-100 text-red-700',
  }

  return statusMap[status] || 'badge-gray'
}

export function isValidLearningPlannerPdfName(fileName: string) {
  return fileName.trim() === LEARNING_PLANNER_EXPECTED_PDF_NAME
}
