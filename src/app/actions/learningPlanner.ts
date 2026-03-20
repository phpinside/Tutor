'use server'

import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { TOTAL_TASK_COUNT } from '@/lib/config'
import {isLearningPlannerEligible} from '@/lib/learningPlanner'

type LearningPlannerFilters = {
  search?: string
  reviewStatus?: string
  startDate?: string
  endDate?: string
}

async function getTeacherSessionId() {
  const cookieStore = await cookies()
  return cookieStore.get('teacherId')?.value || null
}

async function getOperatorSession() {
  const cookieStore = await cookies()
  const session = cookieStore.get('operator_session')

  if (!session) return null

  try {
    const data = JSON.parse(session.value)
    if (!data.operatorId) return null

    return {
      operatorId: data.operatorId as string,
      name: (data.name as string) || '运营老师',
    }
  } catch {
    return null
  }
}

function isValidUrl(url: string) {
  try {
    const parsed = new URL(url)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
  } catch {
    return false
  }
}

function resolveApplicationStatus(approveCount: number, rejectCount: number) {
  if (rejectCount >= 1) return 'REJECTED'
  if (approveCount >= 5 && rejectCount === 0) return 'APPROVED'
  return 'PENDING'
}

function buildFinalDecisionNote(
  rejectReviews: Array<{ operator: { name: string }; reason: string | null }>
) {
  if (rejectReviews.length === 0) return null

  return rejectReviews
    .map((review) => `${review.operator.name}：${review.reason?.trim() || '未填写具体意见'}`)
    .join('\n')
}

export async function getCurrentTeacherLearningPlannerApplication() {
  try {
    const teacherId = await getTeacherSessionId()
    if (!teacherId) {
      return { success: false, error: '未登录' }
    }

    const teacher = await prisma.teacher.findUnique({
      where: { id: teacherId },
      select: {
        id: true,
        name: true,
        status: true,
        currentTaskIndex: true,
        learningPlannerApplication: {
          include: {
            reviews: {
              include: {
                operator: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
              },
              orderBy: {
                createdAt: 'desc',
              },
            },
          },
        },
      },
    })

    if (!teacher) {
      return { success: false, error: '老师不存在' }
    }

    return {
      success: true,
      teacher,
      application: teacher.learningPlannerApplication,
      isEligible: isLearningPlannerEligible(
        teacher.status,
        teacher.currentTaskIndex,
        TOTAL_TASK_COUNT
      ),
    }
  } catch (error) {
    console.error('获取学习规划师申请失败:', error)
    return { success: false, error: '获取申请信息失败，请重试' }
  }
}

export async function submitLearningPlannerApplication(data: {
  studyPlanPdfUrl: string
  studyPlanPdfName: string
  trialLessonVideoUrl: string
  statement: string
}) {
  try {
    const teacherId = await getTeacherSessionId()
    if (!teacherId) {
      return { success: false, error: '请先登录' }
    }

    const teacher = await prisma.teacher.findUnique({
      where: { id: teacherId },
      select: {
        id: true,
        status: true,
        currentTaskIndex: true,
        learningPlannerApplication: {
          select: { id: true },
        },
      },
    })

    if (!teacher) {
      return { success: false, error: '老师不存在' }
    }

    if (
      !isLearningPlannerEligible(
        teacher.status,
        teacher.currentTaskIndex,
        TOTAL_TASK_COUNT
      )
    ) {
      return { success: false, error: '完成伴学师引导任务后才可申请学习规划师资格认证' }
    }

    if (teacher.learningPlannerApplication) {
      return { success: false, error: '你已提交过学习规划师资格认证申请' }
    }

    if (!data.studyPlanPdfUrl?.trim()) {
      return { success: false, error: '请先上传学习规划书 PDF' }
    }

  
    if (!data.trialLessonVideoUrl?.trim() || !isValidUrl(data.trialLessonVideoUrl.trim())) {
      return { success: false, error: '请填写有效的腾讯会议录像链接' }
    }

    if (!data.statement?.trim()) {
      return { success: false, error: '请填写个人申请陈述和补充说明' }
    }

    const application = await prisma.learningPlannerApplication.create({
      data: {
        teacherId,
        studyPlanPdfUrl: data.studyPlanPdfUrl.trim(),
        studyPlanPdfName: data.studyPlanPdfName.trim(),
        trialLessonVideoUrl: data.trialLessonVideoUrl.trim(),
        statement: data.statement.trim(),
      },
    })

    revalidatePath('/onboarding/complete')
    revalidatePath('/onboarding/planner-certification')
    revalidatePath('/operator/planner-review')
    revalidatePath(`/admin/teachers/${teacherId}`)

    return { success: true, application }
  } catch (error) {
    console.error('提交学习规划师申请失败:', error)
    return { success: false, error: '提交申请失败，请重试' }
  }
}

export async function getLearningPlannerApplications(filters?: LearningPlannerFilters) {
  try {
    const operatorSession = await getOperatorSession()
    if (!operatorSession) {
      return { success: false, error: '未登录' }
    }

    const whereConditions: Record<string, unknown>[] = []

    if (filters?.search?.trim()) {
      const keyword = filters.search.trim()
      whereConditions.push({
        teacher: {
          name: {
            contains: keyword,
            mode: 'insensitive',
          },
        },
      })
    }

    if (filters?.reviewStatus === 'pending') {
      whereConditions.push({ status: 'PENDING' })
    } else if (filters?.reviewStatus === 'reviewed') {
      whereConditions.push({ status: { in: ['APPROVED', 'REJECTED'] } })
    }

    if (filters?.startDate || filters?.endDate) {
      const submittedAt: Record<string, Date> = {}

      if (filters.startDate) {
        submittedAt.gte = new Date(filters.startDate)
      }

      if (filters.endDate) {
        const endDate = new Date(filters.endDate)
        endDate.setHours(23, 59, 59, 999)
        submittedAt.lte = endDate
      }

      whereConditions.push({ submittedAt })
    }

    const where = whereConditions.length > 0 ? { AND: whereConditions } : {}

    const [applications, total, pendingCount, reviewedCount] = await Promise.all([
      prisma.learningPlannerApplication.findMany({
        where,
        include: {
          teacher: {
            select: {
              id: true,
              name: true,
              school: true,
              mathScore: true,
            },
          },
          reviews: {
            where: {
              operatorId: operatorSession.operatorId,
            },
            select: {
              id: true,
              decision: true,
              reason: true,
              createdAt: true,
              operator: {
                select: { name: true },
              },
            },
            take: 1,
            orderBy: {
              createdAt: 'desc',
            },
          },
        },
        orderBy: {
          submittedAt: 'desc',
        },
      }),
      prisma.learningPlannerApplication.count(),
      prisma.learningPlannerApplication.count({ where: { status: 'PENDING' } }),
      prisma.learningPlannerApplication.count({
        where: { status: { in: ['APPROVED', 'REJECTED'] } },
      }),
    ])

    return {
      success: true,
      applications: applications.map((application) => ({
        ...application,
        currentOperatorReview: application.reviews[0] || null,
      })),
      stats: {
        total,
        pending: pendingCount,
        reviewed: reviewedCount,
      },
      currentOperator: operatorSession,
    }
  } catch (error) {
    console.error('获取学习规划师申请列表失败:', error)
    return { success: false, error: '获取申请列表失败，请重试' }
  }
}

export async function reviewLearningPlannerApplication(
  applicationId: string,
  decision: 'APPROVED' | 'REJECTED',
  reason?: string,
  imageUrls?: string[]
) {
  try {
    const operatorSession = await getOperatorSession()
    if (!operatorSession) {
      return { success: false, error: '未登录' }
    }

    if (!applicationId) {
      return { success: false, error: '申请记录不存在' }
    }

    const trimmedReason = reason?.trim()
    if (decision === 'REJECTED' && !trimmedReason) {
      return { success: false, error: '请填写不通过原因和描述' }
    }

    const result = await prisma.$transaction(async (tx) => {
      const application = await tx.learningPlannerApplication.findUnique({
        where: { id: applicationId },
        select: {
          id: true,
          teacherId: true,
          status: true,
        },
      })

      if (!application) {
        throw new Error('申请记录不存在')
      }

      if (application.status !== 'PENDING') {
        throw new Error('该申请已完成审核')
      }

      const existingReview = await tx.learningPlannerReview.findUnique({
        where: {
          applicationId_operatorId: {
            applicationId,
            operatorId: operatorSession.operatorId,
          },
        },
      })

      if (existingReview) {
        throw new Error('你已经审核过该申请')
      }

      const reviewData = {
        applicationId,
        operatorId: operatorSession.operatorId,
        decision,
        reason: decision === 'REJECTED' ? trimmedReason : null,
        imageUrls: decision === 'REJECTED' ? (imageUrls ?? []) : [],
      }
      await tx.learningPlannerReview.create({ data: reviewData as never })

      const [approveCount, rejectCount, rejectReviews] = await Promise.all([
        tx.learningPlannerReview.count({
          where: {
            applicationId,
            decision: 'APPROVED',
          },
        }),
        tx.learningPlannerReview.count({
          where: {
            applicationId,
            decision: 'REJECTED',
          },
        }),
        tx.learningPlannerReview.findMany({
          where: {
            applicationId,
            decision: 'REJECTED',
          },
          include: {
            operator: {
              select: {
                name: true,
              },
            },
          },
          orderBy: {
            createdAt: 'asc',
          },
        }),
      ])

      const nextStatus = resolveApplicationStatus(approveCount, rejectCount)

      const updatedApplication = await tx.learningPlannerApplication.update({
        where: { id: applicationId },
        data: {
          approveCount,
          rejectCount,
          status: nextStatus as 'PENDING' | 'APPROVED' | 'REJECTED',
          finalReviewedAt: nextStatus === 'PENDING' ? null : new Date(),
          finalDecisionNote:
            nextStatus === 'REJECTED' ? buildFinalDecisionNote(rejectReviews) : null,
        },
        select: {
          id: true,
          teacherId: true,
          status: true,
        },
      })

      return updatedApplication
    })

    revalidatePath('/operator/planner-review')
    revalidatePath('/onboarding/planner-certification')
    revalidatePath('/onboarding/complete')
    revalidatePath(`/admin/teachers/${result.teacherId}`)

    return { success: true, application: result }
  } catch (error) {
    console.error('审核学习规划师申请失败:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : '审核失败，请重试',
    }
  }
}

export async function resetLearningPlannerApplication() {
  try {
    const teacherId = await getTeacherSessionId()
    if (!teacherId) return { success: false, error: '请先登录' }

    const application = await prisma.learningPlannerApplication.findUnique({
      where: { teacherId },
      select: { id: true, status: true },
    })

    if (!application) return { success: false, error: '申请记录不存在' }

    if (application.status !== 'REJECTED') {
      return { success: false, error: '只有审核不通过的申请才能重新提交' }
    }

    await prisma.learningPlannerApplication.delete({ where: { teacherId } })

    revalidatePath('/onboarding/planner-certification')
    revalidatePath('/onboarding/complete')

    return { success: true }
  } catch (error) {
    console.error('重置学习规划师申请失败:', error)
    return { success: false, error: '操作失败，请重试' }
  }
}
