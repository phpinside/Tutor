'use server'

import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import { revalidatePath } from 'next/cache'

export async function getOperators() {
  return prisma.operator.findMany({
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      name: true,
      phone: true,
      isEnabled: true,
      remarks: true,
      createdAt: true,
      _count: { select: { teamTeachers: true } },
    },
  })
}

export async function getOperatorById(id: string) {
  return prisma.operator.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      phone: true,
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
  isEnabled?: boolean
  remarks?: string
}) {
  const exists = await prisma.operator.findUnique({ where: { phone: data.phone } })
  if (exists) {
    return { success: false, error: '该手机号已存在' }
  }

  const hashedPassword = await bcrypt.hash(data.password, 10)
  const operator = await prisma.operator.create({
    data: {
      name: data.name,
      phone: data.phone,
      password: hashedPassword,
      isEnabled: data.isEnabled ?? true,
      remarks: data.remarks || null,
    },
  })

  revalidatePath('/admin/operators')
  return { success: true, operator }
}

export async function updateOperator(
  id: string,
  data: {
    name?: string
    isEnabled?: boolean
    remarks?: string
  }
) {
  await prisma.operator.update({
    where: { id },
    data: {
      ...(data.name !== undefined && { name: data.name }),
      ...(data.isEnabled !== undefined && { isEnabled: data.isEnabled }),
      ...(data.remarks !== undefined && { remarks: data.remarks }),
      updatedAt: new Date(),
    },
  })

  revalidatePath('/admin/operators')
  revalidatePath(`/admin/operators/${id}`)
  return { success: true }
}

export async function resetOperatorPassword(id: string, newPassword: string) {
  const hashedPassword = await bcrypt.hash(newPassword, 10)
  await prisma.operator.update({
    where: { id },
    data: { password: hashedPassword, updatedAt: new Date() },
  })
  return { success: true }
}

export async function deleteOperator(id: string) {
  await prisma.operator.delete({ where: { id } })
  revalidatePath('/admin/operators')
  return { success: true }
}
