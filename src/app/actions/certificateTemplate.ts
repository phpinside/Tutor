'use server'

import { revalidatePath } from 'next/cache'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { isSuperAdmin } from '@/lib/admin-auth'
import { DATE_DEFAULT_TOKENS, RESERVED_FIELD_KEYS, type CertificateTypeKey, type TemplateFieldDef, type TemplateFieldType } from '@/lib/certificate-template'

export interface CertificateTemplateInput {
  type: CertificateTypeKey
  name: string
  title: string
  companyName: string
  companyIds: string[]
  defaultCompanyId: string | null
  bodyText: string
  fields: TemplateFieldDef[]
  isActive: boolean
  sortOrder: number
}

const VALID_TYPES: CertificateTypeKey[] = ['INTERNSHIP', 'LABOR_CONFIRMATION']
const VALID_FIELD_TYPES: TemplateFieldType[] = ['text', 'date', 'number', 'amount', 'select']
const FIELD_KEY_PATTERN = /^[A-Za-z][A-Za-z0-9_]{0,31}$/

type ValidateResult =
  | { ok: true; value: CertificateTemplateInput }
  | { ok: false; error: string }

async function validateInput(input: CertificateTemplateInput): Promise<ValidateResult> {
  if (!VALID_TYPES.includes(input.type)) return { ok: false, error: '证明类型无效' }
  const name = input.name?.trim() ?? ''
  if (!name) return { ok: false, error: '请填写模板名称' }
  const title = input.title?.trim() ?? ''
  if (!title) return { ok: false, error: '请填写 PDF 标题' }
  const companyName = input.companyName?.trim() ?? ''
  if (!companyName) return { ok: false, error: '请填写落款单位名称' }
  const bodyText = input.bodyText ?? ''
  if (!bodyText.trim()) return { ok: false, error: '请填写正文内容' }
  if (bodyText.length > 20000) return { ok: false, error: '正文内容过长' }
  if (!Number.isInteger(input.sortOrder) || input.sortOrder < 0) return { ok: false, error: '排序值无效' }

  const companyIds = [...new Set(Array.isArray(input.companyIds) ? input.companyIds.filter((id) => typeof id === 'string' && id) : [])]
  if (input.defaultCompanyId && !companyIds.includes(input.defaultCompanyId)) {
    return { ok: false, error: '默认单位必须在可选单位列表内' }
  }
  if (companyIds.length > 0) {
    const activeCount = await prisma.certificateCompany.count({
      where: { id: { in: companyIds }, isActive: true },
    })
    if (activeCount !== companyIds.length) {
      return { ok: false, error: '可选单位中存在无效或已停用的单位，请重新选择' }
    }
  }

  const fields = Array.isArray(input.fields) ? input.fields : []
  const seenKeys = new Set<string>()
  for (const field of fields) {
    if (!FIELD_KEY_PATTERN.test(field.key)) {
      return { ok: false, error: `字段 key「${field.key || '空'}」无效（需以字母开头，仅含字母/数字/下划线）` }
    }
    if (RESERVED_FIELD_KEYS.includes(field.key)) {
      return { ok: false, error: `字段 key「${field.key}」为系统保留占位符，请更换` }
    }
    if (seenKeys.has(field.key)) return { ok: false, error: `字段 key「${field.key}」重复` }
    seenKeys.add(field.key)
    if (!field.label?.trim()) return { ok: false, error: `字段「${field.key}」缺少显示名称` }
    if (!VALID_FIELD_TYPES.includes(field.type)) return { ok: false, error: `字段「${field.key}」类型无效` }
    if (field.type === 'select' && (!field.options || field.options.length === 0)) {
      return { ok: false, error: `下拉字段「${field.key}」至少需要一个选项` }
    }
    const fieldDefault = typeof field.default === 'string' ? field.default.trim() : ''
    if (fieldDefault) {
      if (field.type !== 'date') return { ok: false, error: `字段「${field.key}」不支持默认值（仅日期字段支持）` }
      if (!DATE_DEFAULT_TOKENS.includes(fieldDefault as (typeof DATE_DEFAULT_TOKENS)[number])) {
        return { ok: false, error: `字段「${field.key}」默认值无效` }
      }
    }
  }

  return {
    ok: true,
    value: {
      type: input.type,
      name,
      title,
      companyName,
      companyIds,
      defaultCompanyId: input.defaultCompanyId ?? null,
      bodyText,
      fields: fields.map((field) => {
        const fieldDefault = typeof field.default === 'string' ? field.default.trim() : ''
        return {
          key: field.key,
          label: field.label.trim(),
          type: field.type,
          required: field.required === true,
          ...(field.type === 'select' ? { options: field.options } : {}),
          ...(field.placeholder?.trim() ? { placeholder: field.placeholder.trim() } : {}),
          ...(field.type === 'date' && fieldDefault ? { default: fieldDefault } : {}),
        }
      }),
      isActive: input.isActive === true,
      sortOrder: input.sortOrder,
    },
  }
}

function revalidateTemplatePages() {
  revalidatePath('/admin/certificates/templates')
}

/** Prisma Json 字段需要标准 JSON 值类型，数组/字段定义无索引签名需显式转换 */
function toDbData(value: CertificateTemplateInput): Prisma.CertificateTemplateUncheckedCreateInput {
  return {
    ...value,
    companyIds: value.companyIds as unknown as Prisma.InputJsonValue,
    fields: value.fields as unknown as Prisma.InputJsonValue,
  }
}

export async function createCertificateTemplate(input: CertificateTemplateInput) {
  if (!(await isSuperAdmin())) return { success: false as const, error: '仅超级管理员可管理模板' }

  const validated = await validateInput(input)
  if (!validated.ok) return { success: false as const, error: validated.error }

  const exists = await prisma.certificateTemplate.findUnique({
    where: { type_name: { type: validated.value.type, name: validated.value.name } },
    select: { id: true },
  })
  if (exists) return { success: false as const, error: '同类型下已存在同名模板' }

  const template = await prisma.certificateTemplate.create({ data: toDbData(validated.value) })
  revalidateTemplatePages()
  return { success: true as const, id: template.id }
}

export async function updateCertificateTemplate(id: string, input: CertificateTemplateInput) {
  if (!(await isSuperAdmin())) return { success: false as const, error: '仅超级管理员可管理模板' }

  const validated = await validateInput(input)
  if (!validated.ok) return { success: false as const, error: validated.error }

  try {
    await prisma.certificateTemplate.update({ where: { id }, data: toDbData(validated.value) })
  } catch {
    return { success: false as const, error: '模板不存在或保存失败' }
  }
  revalidateTemplatePages()
  return { success: true as const }
}

export async function setCertificateTemplateActive(id: string, isActive: boolean) {
  if (!(await isSuperAdmin())) return { success: false as const, error: '仅超级管理员可管理模板' }

  await prisma.certificateTemplate.update({ where: { id }, data: { isActive } }).catch(() => null)
  revalidateTemplatePages()
  return { success: true as const }
}

export async function deleteCertificateTemplate(id: string) {
  if (!(await isSuperAdmin())) return { success: false as const, error: '仅超级管理员可管理模板' }

  await prisma.certificateTemplate.delete({ where: { id } }).catch(() => null)
  revalidateTemplatePages()
  return { success: true as const }
}
