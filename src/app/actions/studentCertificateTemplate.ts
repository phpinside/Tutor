'use server'

import { randomUUID } from 'crypto'
import { revalidatePath } from 'next/cache'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { isSuperAdmin } from '@/lib/admin-auth'
import { CERTIFICATE_SLOT_KEYS, type CertificateOrientation, type CertificateSlots } from '@/lib/student-certificate-config'
import { serializeCertificateTemplate } from '@/lib/student-certificate-templates'
import { certificateBackgroundExists, certificateBackgroundFilePath } from '@/lib/student-certificate-template-files'

export type StudentCertificateTemplateInput = {
  name: string
  description: string
  title: string
  orientation: CertificateOrientation
  slots: CertificateSlots
  sortOrder: number
  backgroundPath?: string
}

function refresh() {
  revalidatePath('/admin/student-certificate-records')
  revalidatePath('/onboarding/tools/student-certificate')
}

function validate(input: StudentCertificateTemplateInput): string | null {
  if (!input || !['LANDSCAPE', 'PORTRAIT'].includes(input.orientation)) return '奖状方向无效'
  if (!input.name?.trim() || input.name.length > 60) return '模板名称无效'
  if (typeof input.title !== 'string' || input.title.length > 30 || (input.slots?.title?.visible && !input.title.trim())) return '固定标题无效'
  if (typeof input.description !== 'string' || input.description.length > 120) return '模板说明过长'
  if (!Number.isInteger(input.sortOrder) || Math.abs(input.sortOrder) > 100000) return '排序值无效'
  if (input.backgroundPath && !certificateBackgroundFilePath(input.backgroundPath)) return '底图来源无效'
  if (!input.slots || typeof input.slots !== 'object') return '文字布局无效'
  for (const key of CERTIFICATE_SLOT_KEYS) {
    const slot = input.slots[key]
    if (!slot || ![slot.x, slot.y, slot.width, slot.height, slot.fontSize].every(Number.isFinite) ||
      slot.x < 0 || slot.y < 0 || slot.width <= 0 || slot.height <= 0 ||
      slot.x + slot.width > 1.001 || slot.y + slot.height > 1.001 ||
      slot.fontSize < 12 || slot.fontSize > 120 || !/^#[0-9a-fA-F]{6}$/.test(slot.color) ||
      !['left', 'center', 'right'].includes(slot.align) || ![400, 700].includes(slot.weight) ||
      typeof slot.visible !== 'boolean' || (slot.frame !== undefined && typeof slot.frame !== 'boolean')) return `${key} 文字区域无效`
  }
  for (const key of ['studentName', 'awardName', 'citation', 'issuer', 'issueDate'] as const) {
    if (!input.slots[key].visible) return '姓名、奖项、颁奖词、单位和日期必须显示'
  }
  return null
}

export async function createStudentCertificateTemplate(input: StudentCertificateTemplateInput) {
  if (!(await isSuperAdmin())) return { success: false, error: '仅管理员可管理奖状模板' }
  const error = validate(input)
  if (error) return { success: false, error }
  if (!input.backgroundPath || !(await certificateBackgroundExists(input.backgroundPath))) return { success: false, error: '请上传奖状底图' }
  const row = await prisma.studentCertificateTemplate.create({ data: {
    id: randomUUID(), name: input.name.trim(), description: input.description.trim(), title: input.title.trim(),
    orientation: input.orientation, backgroundPath: input.backgroundPath, slots: input.slots as unknown as Prisma.InputJsonValue,
    sortOrder: input.sortOrder, isActive: false,
  } })
  refresh()
  return { success: true, template: serializeCertificateTemplate(row) }
}

export async function updateStudentCertificateTemplate(id: string, input: StudentCertificateTemplateInput) {
  if (!(await isSuperAdmin())) return { success: false, error: '仅管理员可管理奖状模板' }
  const error = validate(input)
  if (error) return { success: false, error }
  const existing = await prisma.studentCertificateTemplate.findUnique({ where: { id } })
  if (!existing) return { success: false, error: '模板不存在' }
  if (existing.orientation !== input.orientation) return { success: false, error: '已有模板不可更改横竖方向，请新建模板' }
  if (input.backgroundPath && !(await certificateBackgroundExists(input.backgroundPath))) return { success: false, error: '奖状底图文件不存在，请重新上传' }
  const row = await prisma.studentCertificateTemplate.update({ where: { id }, data: {
    name: input.name.trim(), description: input.description.trim(), title: input.title.trim(), sortOrder: input.sortOrder,
    slots: input.slots as unknown as Prisma.InputJsonValue,
    ...(input.backgroundPath ? { backgroundPath: input.backgroundPath, backgroundKey: null } : {}),
  } })
  refresh()
  return { success: true, template: serializeCertificateTemplate(row) }
}

export async function setStudentCertificateTemplateActive(id: string, active: boolean) {
  if (!(await isSuperAdmin())) return { success: false, error: '仅管理员可管理奖状模板' }
  const row = await prisma.studentCertificateTemplate.findUnique({ where: { id } })
  if (!row || row.archivedAt) return { success: false, error: '模板不存在或已归档' }
  if (!active && row.isActive && await prisma.studentCertificateTemplate.count({ where: { isActive: true, archivedAt: null } }) <= 1) {
    return { success: false, error: '至少保留一套可用奖状模板' }
  }
  await prisma.studentCertificateTemplate.update({ where: { id }, data: { isActive: active } })
  refresh()
  return { success: true }
}

export async function archiveStudentCertificateTemplate(id: string) {
  if (!(await isSuperAdmin())) return { success: false, error: '仅管理员可管理奖状模板' }
  const row = await prisma.studentCertificateTemplate.findUnique({ where: { id } })
  if (!row) return { success: false, error: '模板不存在' }
  if (row.isActive && await prisma.studentCertificateTemplate.count({ where: { isActive: true, archivedAt: null } }) <= 1) {
    return { success: false, error: '至少保留一套可用奖状模板' }
  }
  await prisma.studentCertificateTemplate.update({ where: { id }, data: { archivedAt: new Date(), isActive: false } })
  refresh()
  return { success: true }
}

export async function restoreStudentCertificateTemplate(id: string) {
  if (!(await isSuperAdmin())) return { success: false, error: '仅管理员可管理奖状模板' }
  await prisma.studentCertificateTemplate.update({ where: { id }, data: { archivedAt: null, isActive: false } })
  refresh()
  return { success: true }
}
