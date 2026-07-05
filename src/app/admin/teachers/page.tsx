import { prisma } from '@/lib/prisma'
import { ReferralStatus, ReferralType, TeacherStatus } from '@prisma/client'
import { cookies } from 'next/headers'
import TeachersManagementClient from './TeachersManagementClient'
import { getCoachReviewsForTeachers } from '@/app/actions/coachReview'

export const dynamic = 'force-dynamic'

function parseQueryInt(value: string | undefined): number | null {
  if (value == null || value === '') return null
  const n = parseInt(value, 10)
  return Number.isFinite(n) ? n : null
}

/** 与 resetTeacherPassword 一致：超级管理员或已登录运营 */
async function getCanResetTeacherPassword(): Promise<boolean> {
  const cookieStore = await cookies()
  const adminSession = cookieStore.get('admin_session')
  const operatorSession = cookieStore.get('operator_session')
  if (adminSession) {
    try {
      const data = JSON.parse(adminSession.value)
      if (data.role === 'super_admin') return true
    } catch {
      /* ignore */
    }
  }
  if (operatorSession) {
    try {
      const data = JSON.parse(operatorSession.value)
      if (data.operatorId) return true
    } catch {
      /* ignore */
    }
  }
  return false
}

async function getViewerInfo() {
  const cookieStore = await cookies()
  const operatorSession = cookieStore.get('operator_session')
  if (operatorSession) {
    try {
      const data = JSON.parse(operatorSession.value)
      if (data.operatorId) {
        return { operatorId: data.operatorId as string, isSuperAdmin: false }
      }
    } catch {}
  }
  const adminSession = cookieStore.get('admin_session')
  if (adminSession) {
    try {
      const data = JSON.parse(adminSession.value)
      if (data.role === 'super_admin') {
        return { operatorId: null, isSuperAdmin: true }
      }
    } catch {}
  }
  return { operatorId: null, isSuperAdmin: false }
}

export default async function AdminTeachersPage({
  searchParams
}: {
  searchParams: Promise<{
    page?: string
    search?: string
    taskIndex?: string
    startDate?: string
    endDate?: string
    teamStatus?: string
    inviteAudit?: string
    inviterSearch?: string
    ageMin?: string
    ageMax?: string
    mathScoreMin?: string
    mathScoreMax?: string
    subject?: string
  }>
}) {
  // 解析筛选参数
  const params = await searchParams
  const {
    search,
    taskIndex,
    startDate,
    endDate,
    teamStatus,
    inviteAudit,
    inviterSearch,
    ageMin,
    ageMax,
    mathScoreMin,
    mathScoreMax,
    subject
  } = params
  
  const canResetTeacherPassword = await getCanResetTeacherPassword()
  const viewer = await getViewerInfo()
  
  // 分页参数
  const currentPage = params.page ? parseInt(params.page) : 1
  const pageSize = 50
  
  // 构建查询条件
  const whereConditions: any[] = []
  
  // 搜索关键词（姓名/ID/邀请码/手机号）
  if (search) {
    whereConditions.push({
      OR: [
        { name: { contains: search, mode: 'insensitive' } },
        { id: { contains: search } },
        { inviteCode: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search } }
      ]
    })
  }
  
  // 任务进度
  if (taskIndex) {
    whereConditions.push({
      currentTaskIndex: parseInt(taskIndex)
    })
  }
  
  // 团队状态
  if (teamStatus === 'claimed') {
    whereConditions.push({
      teamAssignment: { isNot: null }
    })
  } else if (teamStatus === 'unclaimed') {
    whereConditions.push({
      teamAssignment: { is: null }
    })
  }
  
  // 邀请人检索（姓名/手机号/ID）
  if (inviterSearch) {
    whereConditions.push({
      invitedBy: {
        OR: [
          { name: { contains: inviterSearch, mode: 'insensitive' } },
          { phone: { contains: inviterSearch } },
          { id: { contains: inviterSearch } }
        ]
      }
    })
  }

  // 审核状态（作为被邀请人的直接邀请记录）
  if (inviteAudit === 'pending') {
    whereConditions.push({
      referredReferrals: {
        some: { type: ReferralType.DIRECT, status: ReferralStatus.PENDING },
      },
    })
  } else if (inviteAudit === 'valid') {
    whereConditions.push({
      referredReferrals: {
        some: { type: ReferralType.DIRECT, status: ReferralStatus.VALID },
      },
    })
  } else if (inviteAudit === 'invalid') {
    whereConditions.push({
      referredReferrals: {
        some: { type: ReferralType.DIRECT, status: ReferralStatus.INVALID },
      },
    })
  } else if (inviteAudit === 'none') {
    whereConditions.push({
      referredReferrals: {
        none: { type: ReferralType.DIRECT },
      },
    })
  }

  // 注册时间区间
  if (startDate || endDate) {
    const dateFilter: any = {}
    if (startDate) {
      dateFilter.gte = new Date(startDate)
    }
    if (endDate) {
      // 包含结束日期当天的所有时间
      const endDateTime = new Date(endDate)
      endDateTime.setHours(23, 59, 59, 999)
      dateFilter.lte = endDateTime
    }
    whereConditions.push({
      createdAt: dateFilter
    })
  }

  // 年龄区间（Int?，null 不匹配带边界的条件）
  const ageLo = parseQueryInt(ageMin)
  const ageHi = parseQueryInt(ageMax)
  if (ageLo != null || ageHi != null) {
    let gte = ageLo ?? undefined
    let lte = ageHi ?? undefined
    if (gte != null && lte != null && gte > lte) {
      const t = gte
      gte = lte
      lte = t
    }
    const ageFilter: { gte?: number; lte?: number } = {}
    if (gte != null) ageFilter.gte = gte
    if (lte != null) ageFilter.lte = lte
    if (Object.keys(ageFilter).length > 0) {
      whereConditions.push({ age: ageFilter })
    }
  }

  // 学科筛选（subjects 数组包含该学科）
  if (subject) {
    whereConditions.push({
      subjects: { has: subject }
    })
  }

  // 高考成绩区间（按所选学科映射字段）
  const scoreLo = parseQueryInt(mathScoreMin)
  const scoreHi = parseQueryInt(mathScoreMax)
  if (scoreLo != null || scoreHi != null) {
    let gte = scoreLo ?? undefined
    let lte = scoreHi ?? undefined
    if (gte != null && lte != null && gte > lte) {
      const t = gte
      gte = lte
      lte = t
    }
    const scoreFilter: { gte?: number; lte?: number } = {}
    if (gte != null) scoreFilter.gte = gte
    if (lte != null) scoreFilter.lte = lte
    if (Object.keys(scoreFilter).length > 0) {
      const scoreField =
        subject === 'PHYSICS' ? 'physicsScore' :
        subject === 'CHEMISTRY' ? 'chemistryScore' :
        'mathScore'
      whereConditions.push({ [scoreField]: scoreFilter })
    }
  }
  
  // 构建查询条件
  const whereClause = {
    status: {
      not: TeacherStatus.NOT_STARTED
    },
    ...(whereConditions.length > 0 ? { AND: whereConditions } : {})
  }
  
  // 计算总数
  const totalCount = await prisma.teacher.count({
    where: whereClause
  })
  
  // 分页查询
  const teachers = await prisma.teacher.findMany({
    where: whereClause,
    orderBy: {
      updatedAt: 'desc'
    },
    skip: (currentPage - 1) * pageSize,
    take: pageSize,
    select: {
      id: true,
      name: true,
      phone: true,
      school: true,
      mathScore: true,
      physicsScore: true,
      chemistryScore: true,
      subjects: true,
      primarySubject: true,
      status: true,
      currentTaskIndex: true,
      updatedAt: true,
      teamAssignment: {
        select: {
          id: true,
          operator: { select: { name: true } },
        },
      },
      invitedBy: {
        select: { name: true }
      }
    }
  })
  
  // 分页信息
  const totalPages = Math.ceil(totalCount / pageSize)
  const pagination = {
    currentPage,
    totalPages,
    totalCount,
    pageSize,
    hasNextPage: currentPage < totalPages,
    hasPrevPage: currentPage > 1
  }

  // 获取本页教练的审核记录
  const teacherIds = teachers.map((t) => t.id)
  const reviewMap = await getCoachReviewsForTeachers(teacherIds)
  const reviewData: Record<string, unknown> = {}
  for (const [tid, snap] of reviewMap) {
    reviewData[tid] = snap
  }

  const batchableTeacherIds = teachers
    .filter((t) => {
      const r = reviewMap.get(t.id)
      return (
        r &&
        r.stage === 'FINAL_REVIEW' &&
        r.firstReviewOperatorId !== null &&
        r.finalReviewVerdict === 'PENDING'
      )
    })
    .map((t) => t.id)

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          老师管理
        </h1>
        <p className="text-gray-600 mb-2">
          管理和查看所有注册老师的信息
        </p>
      </div>
      
      <TeachersManagementClient 
        initialTeachers={teachers}
        initialFilters={{
          search,
          taskIndex,
          startDate,
          endDate,
          teamStatus,
          inviteAudit,
          inviterSearch,
          ageMin,
          ageMax,
          mathScoreMin,
          mathScoreMax,
          subject
        }}
        pagination={pagination}
        canResetTeacherPassword={canResetTeacherPassword}
        viewer={viewer}
        reviewMap={reviewData}
        batchableTeacherIds={batchableTeacherIds}
      />
    </div>
  )
}


