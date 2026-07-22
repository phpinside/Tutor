import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import {
  getDirectReferralStatusForReferred,
  getRejectedDirectReferralForReferred,
} from '@/app/actions/referral'
import {
  ensureCoachReview,
  getCoachReviewForTeacher,
  getCoachReviewRejectionForReferred,
} from '@/app/actions/coachReview'
import { getTeacher } from '@/app/actions/teacher'
import { getTaskConfigs } from '@/lib/config'
import CompletionContent from './CompletionContent'

export const dynamic = 'force-dynamic'

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
  const coachReviewRejection = await getCoachReviewRejectionForReferred(teacherId)
  if (rejectedReferral || coachReviewRejection) {
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

  // 确保教练审核记录存在（兜底：submitTask 中 ensureCoachReview 可能因外部 API
  // 未配置等原因静默失败，此处补创，避免页面拿不到审核状态）
  if (!inviteApproved) {
    await ensureCoachReview(teacherId)
  }

  // 获取教练审核记录，用于展示初审/复审状态及归属学管
  const coachReviewResult = await getCoachReviewForTeacher(teacherId)
  const coachReview = coachReviewResult.success ? coachReviewResult.review : null
  const coachReviewStatus = {
    stage: coachReview?.stage ?? null,
    firstReviewVerdict: coachReview?.firstReviewVerdict ?? null,
    firstReviewOperatorName: coachReview?.firstReviewOperatorName ?? null,
    hasFirstReviewer: !!coachReview?.firstReviewOperatorId,
  }

  const profileTaskHref = `/onboarding/task/1`

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
      coachReviewStatus={coachReviewStatus}
    />
  )
}
