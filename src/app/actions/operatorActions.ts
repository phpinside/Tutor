'use server'

import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import { revalidatePath } from 'next/cache'
import { cookies } from 'next/headers'
import { syncPendingFirstReviewer } from '@/lib/externalTutor'
import { getOperatorSessionInfo, isSuperAdminRequest } from '@/lib/operatorAuth'
import { isScopingEnabledFor, isTeacherInScope } from '@/lib/learnerManagerScope'
import { recordAudit } from '@/lib/auditLog'

/**
 * 校验「会话中的学管」与「client 传入的 operatorId」一致，防伪造直调。
 * 超管可操作任意学管；其他身份一律拒绝。
 * 返回 null 表示校验失败。
 */
async function authorizeOperatorAccess(operatorId: string) {
  if (await isSuperAdminRequest()) {
    return { operatorId, name: '管理员' }
  }
  const session = await getOperatorSessionInfo()
  if (!session || session.operatorId !== operatorId) {
    return null
  }
  return { operatorId: session.operatorId, name: session.name }
}

// ——— 团队管理 ———

export async function getOperatorTeam(
  operatorId: string,
  filters?: {
    search?: string
    taskIndex?: string
    startDate?: string
    endDate?: string
    school?: string
    gender?: string
    gaokaoProvince?: string
    subject?: string
    scoreMin?: string
    status?: string
    inviterSearch?: string
  }
) {
  // 会话一致性校验：学管只能查看自己的团队（防伪造直调读取他人团队）
  const session = await authorizeOperatorAccess(operatorId)
  if (!session) return []

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

  // 学校（模糊）
  if (filters?.school?.trim()) {
    whereConditions.push({
      teacher: { school: { contains: filters.school.trim(), mode: 'insensitive' } },
    })
  }

  // 性别
  if (filters?.gender) {
    whereConditions.push({ teacher: { gender: filters.gender } })
  }

  // 高考省份
  if (filters?.gaokaoProvince) {
    whereConditions.push({ teacher: { gaokaoProvince: filters.gaokaoProvince } })
  }

  // 可教科目
  if (filters?.subject) {
    whereConditions.push({ teacher: { subjects: { has: filters.subject } } })
  }

  // 分数下限：任一科高考成绩 ≥ 该值
  const scoreMin = parseInt(filters?.scoreMin || '', 10)
  if (Number.isFinite(scoreMin)) {
    whereConditions.push({
      teacher: {
        OR: [
          { mathScore: { gte: scoreMin } },
          { physicsScore: { gte: scoreMin } },
          { chemistryScore: { gte: scoreMin } },
        ],
      },
    })
  }

  // 状态
  if (filters?.status) {
    whereConditions.push({ teacher: { status: filters.status } })
  }

  // 邀请人（姓名/手机号模糊）
  if (filters?.inviterSearch?.trim()) {
    const kw = filters.inviterSearch.trim()
    whereConditions.push({
      teacher: {
        invitedBy: {
          OR: [
            { name: { contains: kw, mode: 'insensitive' } },
            { phone: { contains: kw } },
          ],
        },
      },
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
  // 会话一致性校验：仅本人（或超管）可认领，防伪造直调把老师加进他人团队
  const session = await authorizeOperatorAccess(operatorId)
  if (!session) {
    return { success: false, error: '无权限操作' }
  }

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

  await recordAudit({
    actorType: 'OPERATOR',
    actorId: operatorId,
    action: 'CLAIM_TEACHER',
    targetType: 'TEACHER',
    targetId: teacherId,
  })

  revalidatePath('/operator/team')
  return { success: true }
}

export async function removeTeacherFromTeam(operatorId: string, teacherId: string) {
  // 会话一致性校验：仅本人（或超管）可移出，防伪造直调移除他人团队老师
  const session = await authorizeOperatorAccess(operatorId)
  if (!session) {
    return { success: false, error: '无权限操作' }
  }

  await prisma.teacherTeam.deleteMany({
    where: { teacherId, operatorId },
  })

  await recordAudit({
    actorType: 'OPERATOR',
    actorId: operatorId,
    action: 'REMOVE_FROM_TEAM',
    targetType: 'TEACHER',
    targetId: teacherId,
  })

  revalidatePath('/operator/team')
  return { success: true }
}

// 手机号脱敏：保留前 3 后 4
function maskPhone(phone: string): string {
  if (!phone) return '****'
  return phone.length >= 8 ? `${phone.slice(0, 3)}****${phone.slice(-4)}` : '****'
}

/**
 * 认领搜索：仅返回无归属老师（认领对象必然不在学管可见白名单内，
 * 这是白名单模型的业务必需例外通道），展示脱敏手机号；
 * 精确手机号检索不受最小长度限制，模糊搜索至少 4 个字符，降低遍历泄露风险。
 */
export async function searchTeachersForClaim(keyword: string) {
  const kw = keyword.trim()
  if (!kw) return []

  const isExactPhone = /^\d{7,11}$/.test(kw)
  if (kw.length < 4 && !isExactPhone) return []

  const teachers = await prisma.teacher.findMany({
    where: {
      teamAssignment: { is: null },
      OR: [
        { name: { contains: kw, mode: 'insensitive' } },
        { phone: { contains: kw } },
        { inviteCode: { contains: kw, mode: 'insensitive' } },
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
    take: 10,
    orderBy: { createdAt: 'desc' },
  })

  return teachers.map((t) => ({ ...t, phone: maskPhone(t.phone) }))
}

/**
 * 全量老师搜索（团队成员弹窗入口）。
 * 启用白名单 scoping 的学管自动降级为「认领搜索」（仅无归属老师、脱敏）；
 * 超管或未启用 scoping 的学管保持现状全量搜索。
 */
export async function searchAllTeachers(keyword: string) {
  const kw = keyword.trim()
  if (!kw) return []

  const operatorSession = await getOperatorSessionInfo()
  if (operatorSession && (await isScopingEnabledFor(operatorSession.operatorId))) {
    return searchTeachersForClaim(kw)
  }

  return prisma.teacher.findMany({
    where: {
      OR: [
        { name: { contains: kw, mode: 'insensitive' } },
        { phone: { contains: kw } },
        { id: { contains: kw } },
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
  // 备注归属校验：学管只能以本人身份写备注且老师须在白名单内；
  // operatorId=null（管理员备注）仅超管会话可写
  if (data.operatorId) {
    const session = await authorizeOperatorAccess(data.operatorId)
    if (!session) {
      return { success: false as const, error: '无权限操作' }
    }
    if (await isScopingEnabledFor(data.operatorId)) {
      const inScope = await isTeacherInScope(data.operatorId, data.teacherId)
      if (!inScope) {
        return { success: false as const, error: '该老师不在你的可见范围内' }
      }
    }
  } else if (!(await isSuperAdminRequest())) {
    return { success: false as const, error: '无权限操作' }
  }
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
  return { success: true as const, remark }
}

export async function getTeacherRemarks(teacherId: string) {
  // 学管启用白名单后，仅可读白名单内老师的备注（备注属于老师数据）
  const operatorSession = await getOperatorSessionInfo()
  if (operatorSession && (await isScopingEnabledFor(operatorSession.operatorId))) {
    const inScope = await isTeacherInScope(operatorSession.operatorId, teacherId)
    if (!inScope) return []
  }
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
  // 会话一致性校验：仅本人可改自己的资料/密码，防伪造直调改他人密码（账户接管）
  const session = await authorizeOperatorAccess(operatorId)
  if (!session) {
    return { success: false, error: '无权限操作' }
  }
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
  // 会话一致性校验：仅本人可读自己的资料
  const session = await authorizeOperatorAccess(operatorId)
  if (!session) {
    return null
  }
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

// ——— 运营搜索与跟进人调整（统一分配模型） ———

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

export async function updateTeacherFollower(
  teacherId: string,
  operatorId: string | null
): Promise<{ success: boolean; error?: string }> {
  const cookieStore = await cookies()
  const session = cookieStore.get('admin_session')
  if (!session) {
    return { success: false, error: '无权限' }
  }
  try {
    const data = JSON.parse(session.value)
    if (data.role !== 'super_admin') {
      return { success: false, error: '无权限，仅超管可修改跟进人' }
    }
  } catch {
    return { success: false, error: '会话无效' }
  }

  try {
    if (operatorId) {
      const operator = await prisma.operator.findUnique({
        where: { id: operatorId },
        select: { isEnabled: true },
      })
      if (!operator) {
        return { success: false, error: '运营不存在' }
      }
      if (!operator.isEnabled) {
        return { success: false, error: '该运营已禁用，无法指派为跟进人' }
      }

      await prisma.teacherTeam.upsert({
        where: { teacherId },
        update: { operatorId },
        create: { teacherId, operatorId },
      })
    } else {
      await prisma.teacherTeam.deleteMany({
        where: { teacherId },
      })
    }

    // 统一分配模型：跟进人 = 初审人。同步待初审记录的初审负责人；
    // 清除跟进人（operatorId=null）则变为合并审核。
    await syncPendingFirstReviewer(teacherId, operatorId)

    await recordAudit({
      actorType: 'ADMIN',
      actorId: 'super_admin',
      actorName: '管理员',
      action: 'UPDATE_TEACHER_FOLLOWER',
      targetType: 'TEACHER',
      targetId: teacherId,
      detail: { newFollowerOperatorId: operatorId },
    })
  } catch (error) {
    console.error('修改跟进人失败:', error)
    return { success: false, error: '操作失败，请重试' }
  }

  revalidatePath('/admin/teachers')
  revalidatePath(`/admin/teachers/${teacherId}`)
  revalidatePath('/operator/team')

  return { success: true }
}
