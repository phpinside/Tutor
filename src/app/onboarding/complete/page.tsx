import { cookies } from '@/lib/auth/compat'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import {
  getDirectReferralStatusForReferred,
  getRejectedDirectReferralForReferred,
} from '@/app/actions/referral'
import {
  ensureCoachReview,
  getCoachReviewForTeacher,
  getCoachReviewRejectionForReferred,
  getCoachReviewChallenge,
} from '@/app/actions/coachReview'
import { getTeacher } from '@/app/actions/teacher'
import { getTaskConfigs } from '@/lib/config'
import { SENSITIVE_FIELDS } from '@/lib/teacherSensitiveFields'
import type { SensitiveField } from '@/lib/teacherSensitiveFields'
import { toInfoChangeItemView } from '@/lib/teacherInfoChangeShared'
import type { InfoChangeItemView } from '@/lib/teacherInfoChangeShared'
import { parseQualificationFiles, parseQualificationMeta } from '@/lib/teacherQualificationShared'
import type { QualificationType } from '@/lib/teacherQualificationShared'
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
  // 质疑取证中的教练需在引导页补交材料，不允许进入完成页
  const coachReviewChallenge = await getCoachReviewChallenge(teacherId)
  if (rejectedReferral || coachReviewRejection || coachReviewChallenge) {
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

  // 2026-11：EDU 注册引导——学管的伴学教练ID。
  // 学管归属与完成页展示同口径（初审负责人 APPROVED → 团队认领人），
  // 以学管手机号反查 teachers.id，即 eduflow 注册时要填的「学管的伴学教练ID」。
  // 学管在 Tutor 中可能没有教师记录（未走过教师入驻），此时置 null 由前端提示联系学管。
  const managerOperator =
    coachReview?.firstReviewVerdict === 'APPROVED' && coachReview.firstReviewOperatorId
      ? await prisma.operator.findUnique({
          where: { id: coachReview.firstReviewOperatorId },
          select: { id: true, name: true, phone: true },
        })
      : teacher.teamAssignment?.operator?.id
        ? {
            id: teacher.teamAssignment.operator.id,
            name: teacher.teamAssignment.operator.name,
            phone: teacher.teamAssignment.operator.phone,
          }
        : null

  let managerTutorId: string | null = null
  if (managerOperator?.phone) {
    const managerTeacher = await prisma.teacher.findUnique({
      where: { phone: managerOperator.phone },
      select: { id: true },
    })
    managerTutorId = managerTeacher?.id ?? null
  }

  // EDU 注册页完整地址（.env 配置，如 https://manager.chulu.net/register/tutor）；
  // 未配置则不放直达链接。
  const eduRegisterUrl = (process.env.EDU_REGISTER_URL || '').trim().replace(/\/+$/, '')

  // 高考资料修改申请：仅在入驻审核通过后开放（教练本人此时不可直改敏感字段）
  const sensitivePassed = coachReview?.stage === 'APPROVED'
  let infoChangeCurrentValues: Record<SensitiveField, string> | null = null
  let infoChangeRequests: InfoChangeItemView[] = []
  let infoChangeQualifications: {
    type: 'DEGREE_CERT' | 'TEACHER_CERT' | 'MANDARIN_CERT'
    files: string[]
    meta: ReturnType<typeof parseQualificationMeta>
  }[] = []
  let infoChangeIsInServiceTeacher = false
  if (sensitivePassed) {
    const teacherRecord = teacher as unknown as Record<string, unknown>
    infoChangeCurrentValues = Object.fromEntries(
      SENSITIVE_FIELDS.map((field) => [
        field,
        teacherRecord[field] === null || teacherRecord[field] === undefined
          ? ''
          : String(teacherRecord[field]),
      ])
    ) as Record<SensitiveField, string>
    const rows = await prisma.teacherInfoChangeRequest.findMany({
      where: { teacherId },
      orderBy: { createdAt: 'desc' },
      take: 20,
    })
    infoChangeRequests = rows.map(toInfoChangeItemView)

    // 已提交的入驻申报资质（资质变更编辑器回填）
    const qualificationRows = await prisma.teacherQualification.findMany({
      where: { teacherId, source: 'ONBOARDING' },
      orderBy: { createdAt: 'desc' },
      take: 10,
    })
    infoChangeQualifications = qualificationRows.map((row) => ({
      type: row.type as 'DEGREE_CERT' | 'TEACHER_CERT' | 'MANDARIN_CERT',
      files: parseQualificationFiles(row.files),
      meta: parseQualificationMeta(row.meta),
    }))
    infoChangeIsInServiceTeacher = teacher.isInServiceTeacher === true
  }

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
      managerName={managerOperator?.name ?? null}
      managerTutorId={managerTutorId}
      eduRegisterUrl={eduRegisterUrl}
      infoChangeSection={
        sensitivePassed && infoChangeCurrentValues
          ? {
              teacherId,
              currentValues: infoChangeCurrentValues,
              initialRequests: infoChangeRequests,
              initialQualifications: infoChangeQualifications,
              isInServiceTeacher: infoChangeIsInServiceTeacher,
            }
          : null
      }
    />
  )
}
