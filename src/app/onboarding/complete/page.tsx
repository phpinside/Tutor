import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import {
  getDirectReferralStatusForReferred,
  getRejectedDirectReferralForReferred,
} from '@/app/actions/referral'
import { getTeacher } from '@/app/actions/teacher'
import { getTaskConfigs } from '@/lib/config'
import CompletionContent from './CompletionContent'

export default async function CompletePage() {
  const cookieStore = await cookies()
  const teacherId = cookieStore.get('teacherId')?.value
  
  if (!teacherId) {
    redirect('/onboarding')
  }
  
  const teacher = await getTeacher(teacherId)
  
  // 从数据库获取任务总数
  const TASKS_CONFIG = await getTaskConfigs()
  const TOTAL_TASKS = TASKS_CONFIG.length
  const isTerminalStatus =
    teacher.status === 'COMPLETED' || teacher.status === 'UNLOCKED'
  const allCompleted = isTerminalStatus || teacher.currentTaskIndex >= TOTAL_TASKS
  
  // 如果还没完成所有任务，重定向回引导页
  if (!allCompleted) {
    redirect('/onboarding')
  }

  const rejectedReferral = await getRejectedDirectReferralForReferred(teacherId)
  if (rejectedReferral) {
    redirect('/onboarding')
  }

  const taskSummaries = TASKS_CONFIG.map((task) => {
    const submission = teacher.taskSubmissions.find((s) => s.taskIndex === task.index)
    return {
      index: task.index,
      title: task.title,
      emoji: task.emoji,
      submissionStatus: submission?.status ?? null,
    }
  })

  const directReferral = await getDirectReferralStatusForReferred(teacherId)
  const inviteApproved = directReferral?.status === 'VALID'
  const profileTaskHref = `/onboarding/task/1}`

  return (
    <CompletionContent
      teacherName={teacher.name}
      teacherId={teacherId}
      totalTasks={TOTAL_TASKS}
      primarySubject={teacher.primarySubject ?? null}
      inviterName={teacher.invitedBy?.name ?? null}
      teamLeaderName={teacher.teamAssignment?.operator.name ?? null}
      taskSummaries={taskSummaries}
      inviteApproved={inviteApproved}
      profileTaskHref={profileTaskHref}
    />
  )
}
