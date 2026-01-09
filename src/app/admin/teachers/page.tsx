import { prisma } from '@/lib/prisma'
import { TeacherStatus } from '@prisma/client'
import TeachersManagementClient from './TeachersManagementClient'

export const dynamic = 'force-dynamic'

export default async function AdminTeachersPage({
  searchParams
}: {
  searchParams: Promise<{
    page?: string
    search?: string
    taskIndex?: string
    startDate?: string
    endDate?: string
    teachingStatus?: string
  }>
}) {
  // 解析筛选参数
  const params = await searchParams
  const { search, taskIndex, startDate, endDate, teachingStatus } = params
  
  // 分页参数
  const currentPage = params.page ? parseInt(params.page) : 1
  const pageSize = 50
  
  // 构建查询条件
  const whereConditions: any[] = []
  
  // 搜索关键词（姓名/ID/邀请码）
  if (search) {
    whereConditions.push({
      OR: [
        { name: { contains: search, mode: 'insensitive' } },
        { id: { contains: search } },
        { inviteCode: { contains: search, mode: 'insensitive' } }
      ]
    })
  }
  
  // 任务进度
  if (taskIndex) {
    whereConditions.push({
      currentTaskIndex: parseInt(taskIndex)
    })
  }
  
  // 授课状态
  if (teachingStatus) {
    whereConditions.push({
      teachingStatus: teachingStatus === 'taught' ? 'TAUGHT' : 'NOT_TAUGHT'
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
      school: true,
      status: true,
      currentTaskIndex: true,
      teachingStatus: true,
      updatedAt: true
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
        initialFilters={{ search, taskIndex, startDate, endDate, teachingStatus }}
        pagination={pagination}
      />
    </div>
  )
}


