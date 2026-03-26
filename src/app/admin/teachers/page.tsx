import { prisma } from '@/lib/prisma'
import { TeacherStatus } from '@prisma/client'
import { cookies } from 'next/headers'
import TeachersManagementClient from './TeachersManagementClient'

export const dynamic = 'force-dynamic'

function parseQueryInt(value: string | undefined): number | null {
  if (value == null || value === '') return null
  const n = parseInt(value, 10)
  return Number.isFinite(n) ? n : null
}

// 获取当前管理员角色
async function getAdminRole(): Promise<string> {
  const cookieStore = await cookies()
  const session = cookieStore.get('admin_session')
  
  if (!session) {
    return 'super_admin'
  }
  
  try {
    const sessionData = JSON.parse(session.value)
    return sessionData.role || 'super_admin'
  } catch {
    return 'super_admin'
  }
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
    teacherStatus?: string
    inviterSearch?: string
    ageMin?: string
    ageMax?: string
    mathScoreMin?: string
    mathScoreMax?: string
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
    teacherStatus,
    inviterSearch,
    ageMin,
    ageMax,
    mathScoreMin,
    mathScoreMax
  } = params
  
  // 获取管理员角色
  const adminRole = await getAdminRole()
  
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

  // 任务状态
  if (teacherStatus === 'in_progress') {
    whereConditions.push({
      status: { in: [TeacherStatus.IN_PROGRESS, TeacherStatus.PENDING_REVIEW] }
    })
  } else if (teacherStatus === 'completed') {
    whereConditions.push({
      status: { in: [TeacherStatus.COMPLETED, TeacherStatus.UNLOCKED] }
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

  // 高考数学分数区间
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
      whereConditions.push({ mathScore: scoreFilter })
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
      status: true,
      currentTaskIndex: true,
      updatedAt: true,
      teamAssignment: {
        select: { id: true }
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
          teacherStatus,
          inviterSearch,
          ageMin,
          ageMax,
          mathScoreMin,
          mathScoreMax
        }}
        pagination={pagination}
        adminRole={adminRole}
      />
    </div>
  )
}


