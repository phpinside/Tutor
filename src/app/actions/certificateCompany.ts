'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { isSuperAdmin } from '@/lib/admin-auth'

export interface CertificateCompanyInput {
  name: string
  stampKey: string | null
  isActive: boolean
  sortOrder: number
}

function revalidateCompanyPages() {
  revalidatePath('/admin/certificates/companies')
}

function validateCompanyInput(input: CertificateCompanyInput): string | null {
  const name = input.name?.trim() ?? ''
  if (!name) return '请填写单位名称'
  if (name.length > 100) return '单位名称过长'
  if (input.stampKey !== null && typeof input.stampKey !== 'string') return '盖章图片参数无效'
  if (!Number.isInteger(input.sortOrder) || input.sortOrder < 0) return '排序值无效'
  return null
}

export async function createCertificateCompany(input: CertificateCompanyInput) {
  if (!(await isSuperAdmin())) return { success: false as const, error: '仅超级管理员可管理单位' }

  const error = validateCompanyInput(input)
  if (error) return { success: false as const, error }

  try {
    await prisma.certificateCompany.create({
      data: { name: input.name.trim(), stampKey: input.stampKey, isActive: input.isActive, sortOrder: input.sortOrder },
    })
  } catch (createError) {
    if (typeof createError === 'object' && createError !== null && (createError as { code?: string }).code === 'P2002') {
      return { success: false as const, error: '已存在同名单位' }
    }
    throw createError
  }
  revalidateCompanyPages()
  return { success: true as const }
}

export async function updateCertificateCompany(id: string, input: CertificateCompanyInput) {
  if (!(await isSuperAdmin())) return { success: false as const, error: '仅超级管理员可管理单位' }

  const error = validateCompanyInput(input)
  if (error) return { success: false as const, error }

  try {
    await prisma.certificateCompany.update({
      where: { id },
      data: { name: input.name.trim(), stampKey: input.stampKey, isActive: input.isActive, sortOrder: input.sortOrder },
    })
  } catch (updateError) {
    if (typeof updateError === 'object' && updateError !== null && (updateError as { code?: string }).code === 'P2002') {
      return { success: false as const, error: '已存在同名单位' }
    }
    return { success: false as const, error: '单位不存在或保存失败' }
  }
  revalidateCompanyPages()
  return { success: true as const }
}

export async function setCertificateCompanyActive(id: string, isActive: boolean) {
  if (!(await isSuperAdmin())) return { success: false as const, error: '仅超级管理员可管理单位' }

  await prisma.certificateCompany.update({ where: { id }, data: { isActive } }).catch(() => null)
  revalidateCompanyPages()
  return { success: true as const }
}

export async function deleteCertificateCompany(id: string) {
  if (!(await isSuperAdmin())) return { success: false as const, error: '仅超级管理员可管理单位' }

  await prisma.certificateCompany.delete({ where: { id } }).catch(() => null)
  revalidateCompanyPages()
  return { success: true as const }
}
