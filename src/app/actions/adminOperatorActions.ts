'use server'

import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import { revalidatePath } from 'next/cache'
import { sanitizeInput } from '@/lib/utils'
import { isSuperAdmin } from '@/lib/admin-auth'
import { recordAudit } from '@/lib/auditLog'

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

export async function getOperators() {
  await assertSuperAdmin()
  return prisma.operator.findMany({
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

  const exists = await prisma.operator.findUnique({ where: { phone } })
  if (exists) {
    return { success: false, error: '该手机号已存在' }
  }

  const hashedPassword = await bcrypt.hash(data.password, 10)
  const operator = await prisma.operator.create({
    data: {
      name,
      phone,
      password: hashedPassword,
      role,
      isEnabled: data.isEnabled ?? true,
      remarks: remarks || null,
    },
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
    select: { isEnabled: true, role: true },
  })
  const role = data.role !== undefined ? normalizeRole(data.role) : undefined

  await prisma.operator.update({
    where: { id },
    data: {
      ...(data.name !== undefined && { name: data.name }),
      ...(role !== undefined && { role }),
      ...(data.isEnabled !== undefined && { isEnabled: data.isEnabled }),
      ...(data.remarks !== undefined && { remarks: data.remarks }),
      updatedAt: new Date(),
    },
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
  const hashedPassword = await bcrypt.hash(newPassword, 10)
  await prisma.operator.update({
    where: { id },
    data: { password: hashedPassword, updatedAt: new Date() },
  })
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
