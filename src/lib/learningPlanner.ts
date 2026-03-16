import studentProfiles from './studentProfile.json'

export const LEARNING_PLANNER_TEMPLATE_URL =
  'https://fn73lnaiyt.feishu.cn/wiki/YNwowYJ3DiAL5ekBhNpcQYrznUd'

export type GradeLevel = 'primary_school' | 'middle_school' | 'high_school'

export type StudentProfileData = {
  id: number
  name: string
  gender: string
  grade: string
  grade_level: GradeLevel
  grade_number: number
  region: string
  school: string
  math_score: number
  math_score_full: number
  math_progress: string
  other_subjects_avg: number
  textbook_version: string
}

const allStudents = studentProfiles as StudentProfileData[]

export function getStudentsByLevel(level: GradeLevel): StudentProfileData[] {
  return allStudents.filter((s) => s.grade_level === level)
}

export function getStudentById(id: number): StudentProfileData | undefined {
  return allStudents.find((s) => s.id === id)
}

export function studentToProfileItems(student: StudentProfileData) {
  return [
    { label: '学生姓名', value: student.name },
    { label: '性别', value: student.gender },
    { label: '年级', value: student.grade },
    { label: '所在地区', value: student.region },
    { label: '就读学校', value: student.school },
    { label: '数学当前成绩', value: `${student.math_score}分（满分${student.math_score_full}）` },
    { label: '学习进度', value: student.math_progress },
    { label: '其他学科平均成绩', value: `${student.other_subjects_avg}分` },
    { label: '数学教材版本', value: student.textbook_version },
  ]
}


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
