'use server'

import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import { revalidatePath } from 'next/cache'

// ——— 团队管理 ———

export async function getOperatorTeam(
  operatorId: string,
  filters?: {
    search?: string
    taskIndex?: string
    startDate?: string
    endDate?: string
  }
) {
  const whereConditions: Record<string, unknown>[] = [{ operatorId }]

  if (filters?.search) {
    whereConditions.push({
      teacher: {
        OR: [
          { name: { contains: filters.search, mode: 'insensitive' } },
          { phone: { contains: filters.search } },
          { id: { contains: filters.search } },
        ],
      },
    })
  }

  if (filters?.taskIndex !== undefined && filters.taskIndex !== '') {
    whereConditions.push({
      teacher: { currentTaskIndex: parseInt(filters.taskIndex) },
    })
  }

  if (filters?.startDate) {
    whereConditions.push({
      teacher: { createdAt: { gte: new Date(filters.startDate) } },
    })
  }

  if (filters?.endDate) {
    whereConditions.push({
      teacher: { createdAt: { lte: new Date(filters.endDate + 'T23:59:59') } },
    })
  }

  const teams = await prisma.teacherTeam.findMany({
    where: { AND: whereConditions },
    include: {
      teacher: {
        select: {
          id: true,
          name: true,
          phone: true,
          school: true,
          status: true,
          currentTaskIndex: true,
          createdAt: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  })

  return teams.map((t) => t.teacher)
}

export async function addTeacherToTeam(operatorId: string, teacherId: string) {
  // 检查老师是否已有归属
  const existing = await prisma.teacherTeam.findUnique({
    where: { teacherId },
    include: { operator: { select: { name: true } } },
  })

  if (existing) {
    return {
      success: false,
      error: '添加失败，此老师已经有老师在跟进了',
    }
  }

  await prisma.teacherTeam.create({
    data: { teacherId, operatorId },
  })

  revalidatePath('/operator/team')
  return { success: true }
}

export async function removeTeacherFromTeam(operatorId: string, teacherId: string) {
  await prisma.teacherTeam.deleteMany({
    where: { teacherId, operatorId },
  })
  revalidatePath('/operator/team')
  return { success: true }
}

export async function searchAllTeachers(keyword: string) {
  if (!keyword.trim()) return []

  return prisma.teacher.findMany({
    where: {
      OR: [
        { name: { contains: keyword, mode: 'insensitive' } },
        { phone: { contains: keyword } },
        { id: { contains: keyword } },
      ],
    },
    select: {
      id: true,
      name: true,
      phone: true,
      school: true,
      status: true,
      currentTaskIndex: true,
      teamAssignment: { select: { operatorId: true, operator: { select: { name: true } } } },
    },
    take: 20,
    orderBy: { createdAt: 'desc' },
  })
}

// ——— 备注日志 ———

export async function addTeacherRemark(data: {
  teacherId: string
  operatorId: string | null
  remarkBy: string
  content: string
}) {
  const remark = await prisma.teacherRemark.create({
    data: {
      teacherId: data.teacherId,
      operatorId: data.operatorId,
      remarkBy: data.remarkBy,
      content: data.content,
    },
  })
  revalidatePath(`/operator/teachers/${data.teacherId}`)
  revalidatePath(`/operator/team/${data.teacherId}`)
  return { success: true, remark }
}

export async function getTeacherRemarks(teacherId: string) {
  return prisma.teacherRemark.findMany({
    where: { teacherId },
    orderBy: { createdAt: 'desc' },
  })
}

// ——— 资料设置 ———

export async function updateOperatorProfile(
  operatorId: string,
  data: {
    name?: string
    password?: string
    wechatQrCode?: string
    remarks?: string
  }
) {
  const updateData: Record<string, unknown> = { updatedAt: new Date() }

  if (data.name) updateData.name = data.name
  if (data.wechatQrCode !== undefined) updateData.wechatQrCode = data.wechatQrCode || null
  if (data.remarks !== undefined) updateData.remarks = data.remarks || null
  if (data.password) {
    updateData.password = await bcrypt.hash(data.password, 10)
  }

  await prisma.operator.update({ where: { id: operatorId }, data: updateData })
  revalidatePath('/operator/settings')
  return { success: true }
}

export async function getOperatorProfile(operatorId: string) {
  return prisma.operator.findUnique({
    where: { id: operatorId },
    select: {
      id: true,
      name: true,
      phone: true,
      wechatQrCode: true,
      remarks: true,
    },
  })
}

// ——— 被邀请人默认跟进人 ———

export async function searchOperators(query: string) {
  if (!query.trim()) return { success: true as const, operators: [] }

  const operators = await prisma.operator.findMany({
    where: {
      isEnabled: true,
      OR: [
        { name: { contains: query, mode: 'insensitive' } },
        { phone: { contains: query } },
      ],
    },
    select: { id: true, name: true, phone: true },
    take: 10,
    orderBy: { name: 'asc' },
  })

  return { success: true as const, operators }
}

export async function setInviterDefaultFollowUpPerson(
  inviterId: string,
  operatorId: string | null
) {
  await prisma.teacher.update({
    where: { id: inviterId },
    data: { defaultInviteeFollowUpId: operatorId },
  })

  revalidatePath(`/admin/teachers/${inviterId}`)

  return { success: true as const }
}
