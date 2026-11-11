'use server'

import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import { revalidatePath } from 'next/cache'
import { sanitizeInput } from '@/lib/utils'
import { isSuperAdmin } from '@/lib/admin-auth'
import { recordAudit } from '@/lib/auditLog'
import { changeAccountPassword, canResetAccount } from '@/lib/auth/accounts'
import { getCurrentSession } from '@/lib/auth/session'

/** 学管账号管理为超管专属；学管 session 直调 Server Action 时在此兜底 */
async function assertSuperAdmin(): Promise<void> {
  if (!(await isSuperAdmin())) {
    throw new Error('仅超级管理员可管理学管账号')
  }
}

const VALID_ROLES = ['LEARNER_MANAGER', 'OPERATOR'] as const
type OperatorRoleValue = (typeof VALID_ROLES)[number]

function normalizeRole(role: unknown): OperatorRoleValue {
  return VALID_ROLES.includes(role as OperatorRoleValue)
    ? (role as OperatorRoleValue)
    : 'LEARNER_MANAGER'
}

export async function getOperators(filters?: {
  name?: string
  phone?: string
  role?: string
  isEnabled?: boolean
}) {
  await assertSuperAdmin()

  const whereConditions: Record<string, unknown>[] = []
  const name = filters?.name?.trim()
  const phone = filters?.phone?.trim()
  const role = filters?.role && VALID_ROLES.includes(filters.role as OperatorRoleValue)
    ? (filters.role as OperatorRoleValue)
    : undefined

  if (name) whereConditions.push({ name: { contains: name, mode: 'insensitive' } })
  if (phone) whereConditions.push({ phone: { contains: phone } })
  if (role) whereConditions.push({ role })
  if (filters?.isEnabled !== undefined) whereConditions.push({ isEnabled: filters.isEnabled })

  return prisma.operator.findMany({
    where: whereConditions.length > 0 ? { AND: whereConditions } : undefined,
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      name: true,
      phone: true,
      role: true,
      isEnabled: true,
      remarks: true,
      createdAt: true,
      _count: { select: { teamTeachers: true } },
    },
  })
}

export async function getOperatorById(id: string) {
  await assertSuperAdmin()
  return prisma.operator.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      phone: true,
      role: true,
      isEnabled: true,
      remarks: true,
      createdAt: true,
      updatedAt: true,
      _count: { select: { teamTeachers: true } },
    },
  })
}

export async function createOperator(data: {
  name: string
  phone: string
  password: string
  role?: 'LEARNER_MANAGER' | 'OPERATOR'
  isEnabled?: boolean
  remarks?: string
}) {
  try {
    await assertSuperAdmin()
  } catch (e) {
    return { success: false as const, error: (e as Error).message }
  }
  const name = sanitizeInput(data.name)
  const phone = sanitizeInput(data.phone)
  const remarks = data.remarks ? sanitizeInput(data.remarks) : undefined
  const role = normalizeRole(data.role)
  if (!name || !/^1[3-9]\d{9}$/.test(phone) || typeof data.password !== 'string' || data.password.length < 6 || data.password.length > 72) {
    return { success: false, error: '请填写姓名、有效手机号和6–72位密码' }
  }

  const exists = await prisma.operator.findUnique({ where: { phone } })
  if (exists) {
    return { success: false, error: '该手机号已存在' }
  }

  const hashedPassword = await bcrypt.hash(data.password, 12)
  const operator = await prisma.$transaction(async tx => {
    // 显式管理员授权可以为已有账号新增角色，保留其统一密码。
    let account = await tx.account.findUnique({ where: { login: phone } })
    const legacyTeacher = await tx.teacher.findUnique({ where: { phone } })
    if (!account && !legacyTeacher) account = await tx.account.create({ data: { login: phone, name, passwordHash: hashedPassword, defaultRole: role } })
    if (account) await tx.accountRole.upsert({ where: { accountId_role: { accountId: account.id, role } }, create: { accountId: account.id, role }, update: { isEnabled: true } })
    return tx.operator.create({ data: { name, phone, password: account?.passwordHash ?? hashedPassword, accountId: account?.id, role, isEnabled: data.isEnabled ?? true, remarks: remarks || null } })
  })

  await recordAudit({
    actorType: 'ADMIN',
    actorId: 'super_admin',
    actorName: '管理员',
    action: 'CREATE_OPERATOR',
    targetType: 'OPERATOR',
    targetId: operator.id,
    detail: { name, phone, role, isEnabled: data.isEnabled ?? true },
  })

  revalidatePath('/admin/operators')
  return { success: true, operator }
}

export async function updateOperator(
  id: string,
  data: {
    name?: string
    role?: 'LEARNER_MANAGER' | 'OPERATOR'
    isEnabled?: boolean
    remarks?: string
  }
) {
  try {
    await assertSuperAdmin()
  } catch (e) {
    return { success: false as const, error: (e as Error).message }
  }
  const previous = await prisma.operator.findUnique({
    where: { id },
    select: { isEnabled: true, role: true, accountId: true },
  })
  const role = data.role !== undefined ? normalizeRole(data.role) : undefined

  await prisma.$transaction(async tx => {
    await tx.operator.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(role !== undefined && { role }),
        ...(data.isEnabled !== undefined && { isEnabled: data.isEnabled }),
        ...(data.remarks !== undefined && { remarks: data.remarks }),
        updatedAt: new Date(),
      },
    })
    if (previous?.accountId && role && role !== previous.role) {
      await tx.accountRole.deleteMany({ where: { accountId: previous.accountId, role: { in: ['LEARNER_MANAGER', 'OPERATOR'] } } })
      await tx.accountRole.create({ data: { accountId: previous.accountId, role } })
      await tx.authSession.deleteMany({ where: { accountId: previous.accountId, activeRole: { in: ['LEARNER_MANAGER', 'OPERATOR'] } } })
      await tx.account.updateMany({ where: { id: previous.accountId, defaultRole: previous.role }, data: { defaultRole: role } })
    }
    if (previous?.accountId && data.isEnabled === false) await tx.authSession.deleteMany({ where: { accountId: previous.accountId, activeRole: { in: ['LEARNER_MANAGER', 'OPERATOR'] } } })
  })

  if (data.isEnabled !== undefined && previous && previous.isEnabled !== data.isEnabled) {
    await recordAudit({
      actorType: 'ADMIN',
      actorId: 'super_admin',
      actorName: '管理员',
      action: data.isEnabled ? 'ENABLE_OPERATOR' : 'DISABLE_OPERATOR',
      targetType: 'OPERATOR',
      targetId: id,
      detail: { from: previous.isEnabled, to: data.isEnabled },
    })
  }

  if (role !== undefined && previous && previous.role !== role) {
    await recordAudit({
      actorType: 'ADMIN',
      actorId: 'super_admin',
      actorName: '管理员',
      action: 'CHANGE_OPERATOR_ROLE',
      targetType: 'OPERATOR',
      targetId: id,
      detail: { from: previous.role, to: role },
    })
  }

  revalidatePath('/admin/operators')
  revalidatePath(`/admin/operators/${id}`)
  return { success: true as const }
}

export async function resetOperatorPassword(id: string, newPassword: string) {
  try {
    await assertSuperAdmin()
  } catch (e) {
    return { success: false as const, error: (e as Error).message }
  }
  if (typeof newPassword !== 'string' || newPassword.length < 6 || newPassword.length > 72) return { success: false, error: '密码需为6–72位' }
  const operator = await prisma.operator.findUniqueOrThrow({ where: { id } })
  const viewer = await getCurrentSession()
  if (operator.accountId) {
    if (!viewer || !(await canResetAccount(viewer.accountId, viewer.activeRole, operator.accountId))) return { success: false, error: '无权重置统一账号' }
    await changeAccountPassword(operator.accountId, newPassword)
  } else {
    await prisma.operator.update({ where: { id }, data: { password: await bcrypt.hash(newPassword, 12) } })
  }
  await recordAudit({
    actorType: 'ADMIN',
    actorId: 'super_admin',
    actorName: '管理员',
    action: 'RESET_OPERATOR_PASSWORD',
    targetType: 'OPERATOR',
    targetId: id,
  })
  return { success: true as const }
}

export async function deleteOperator(id: string) {
  try {
    await assertSuperAdmin()
  } catch (e) {
    return { success: false as const, error: (e as Error).message }
  }
  await prisma.operator.delete({ where: { id } })
  await recordAudit({
    actorType: 'ADMIN',
    actorId: 'super_admin',
    actorName: '管理员',
    action: 'DELETE_OPERATOR',
    targetType: 'OPERATOR',
    targetId: id,
  })
  revalidatePath('/admin/operators')
  return { success: true as const }
}
