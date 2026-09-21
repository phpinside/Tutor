import { cache } from 'react'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import {
  uploadToQiniu,
  generateInternshipCertificatePdfKey,
  generateInternshipCertificateOfficialPdfKey,
  generateInternshipCertificateUploadPdfKey,
  generatePrivateUrl,
} from '@/lib/qiniu'
import { generateCertificatePdf, generateInternshipCertificatePdf } from '@/lib/certificate-pdf'
import {
  buildPlaceholderValues,
  parseCertificateDateMode,
  parseStringIdList,
  parseTemplateFields,
  type CertificateDateMode,
  type CertificateTemplateConfig,
  type CertificateTypeKey,
} from '@/lib/certificate-template'
import { overlayStampOnPdf, type StampPosition } from '@/lib/pdf-stamp'

/** 开具单位选项（落款名称 + 盖章图快照来源） */
export interface CertificateCompanyOption {
  id: string | null // 兜底选项（无单位记录）时为 null
  name: string
  stampKey: string | null
}

/** Prisma 模板记录中参与配置构造的字段 */
export type CertificateTemplateRow = {
  id: string
  type: CertificateTypeKey
  name: string
  title: string
  companyName: string
  companyIds: Prisma.JsonValue
  defaultCompanyId: string | null
  bodyText: string
  fields: Prisma.JsonValue
  dateMode: string
  fixedDate: string | null
  isActive: boolean
  sortOrder: number
}

/** 从 Prisma 模板记录构造纯配置对象 */
export function serializeTemplateConfig(row: CertificateTemplateRow): CertificateTemplateConfig {
  return {
    id: row.id,
    type: row.type,
    name: row.name,
    title: row.title,
    companyName: row.companyName,
    companyIds: parseStringIdList(row.companyIds),
    defaultCompanyId: row.defaultCompanyId,
    bodyText: row.bodyText,
    fields: parseTemplateFields(row.fields),
    dateMode: parseCertificateDateMode(row.dateMode),
    fixedDate: typeof row.fixedDate === 'string' && row.fixedDate ? row.fixedDate : null,
    isActive: row.isActive,
    sortOrder: row.sortOrder,
  }
}

/**
 * 模板快照保留的渲染相关字段。快照用于开具时重新渲染，
 * 其中 dateMode 为「开具当天 / 上月首日 / 上月末日」时按渲染时刻求值。
 */
const TEMPLATE_SNAPSHOT_KEYS = [
  'id',
  'type',
  'name',
  'title',
  'companyName',
  'companyIds',
  'defaultCompanyId',
  'bodyText',
  'fields',
  'dateMode',
  'fixedDate',
] as const

/** 生成草稿的模板快照（仅存渲染相关字段，避免开具前改模板导致已提交草稿串版） */
export function toTemplateSnapshot(config: CertificateTemplateConfig): Prisma.InputJsonValue {
  const snapshot: Record<string, unknown> = {}
  for (const key of TEMPLATE_SNAPSHOT_KEYS) snapshot[key] = config[key]
  return snapshot as Prisma.InputJsonValue
}

/** 解析草稿上的模板快照；结构非法返回 null，调用方回退到当前模板记录 */
export function parseTemplateSnapshot(raw: Prisma.JsonValue | null | undefined): CertificateTemplateConfig | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const record = raw as Record<string, unknown>
  const required = ['id', 'name', 'title', 'bodyText'] as const
  for (const key of required) {
    if (typeof record[key] !== 'string' || !(record[key] as string)) return null
  }
  return {
    id: record.id as string,
    type: (record.type === 'LABOR_CONFIRMATION' ? 'LABOR_CONFIRMATION' : 'INTERNSHIP') as CertificateTypeKey,
    name: record.name as string,
    title: record.title as string,
    companyName: typeof record.companyName === 'string' && record.companyName ? record.companyName : '',
    companyIds: parseStringIdList(record.companyIds),
    defaultCompanyId: typeof record.defaultCompanyId === 'string' ? record.defaultCompanyId : null,
    bodyText: record.bodyText as string,
    fields: parseTemplateFields(record.fields),
    dateMode: parseCertificateDateMode(record.dateMode),
    fixedDate: typeof record.fixedDate === 'string' && record.fixedDate ? record.fixedDate : null,
    isActive: true,
    sortOrder: 0,
  }
}

/** 草稿渲染用的字段数据（公共字段 + 扩展数据 + 提交时快照的落款单位） */
type DraftFieldData = {
  name: string | null
  gender: string | null
  idCard: string | null
  startDate: Date | null
  endDate: Date | null
  extraData: Prisma.JsonValue | null
  companyName: string
}

/**
 * 用模板配置渲染草稿 PDF：落款单位以草稿快照为准（用户可能自选单位），
 * 落款日期按 now 由模板「落款日期」配置算出（开具当天等相对日期以此为准）。
 */
export async function renderDraftPdf(
  draft: DraftFieldData,
  config: CertificateTemplateConfig,
  now: Date = new Date()
): Promise<Buffer> {
  const effectiveConfig = draft.companyName ? { ...config, companyName: draft.companyName } : config
  const values = buildPlaceholderValues(
    effectiveConfig,
    {
      name: draft.name,
      gender: draft.gender,
      idCard: draft.idCard,
      startDate: draft.startDate,
      endDate: draft.endDate,
      extraData: toStringRecord(draft.extraData),
    },
    now
  )
  return generateCertificatePdf(effectiveConfig, values)
}

/** 草稿的模板配置：优先用提交时的快照，缺失（历史草稿）回退当前模板记录 */
export function resolveDraftTemplateConfig(draft: {
  templateSnapshot: Prisma.JsonValue | null
  template?: CertificateTemplateRow | null
}): CertificateTemplateConfig | null {
  return parseTemplateSnapshot(draft.templateSnapshot) ?? (draft.template ? serializeTemplateConfig(draft.template) : null)
}

/** 激活中的证明模板（按类型 + 排序），用户端选择使用，请求内缓存 */
export const getActiveCertificateTemplates = cache(async (): Promise<CertificateTemplateConfig[]> => {
  const rows = await prisma.certificateTemplate.findMany({
    where: { isActive: true },
    orderBy: [{ type: 'asc' }, { sortOrder: 'asc' }, { createdAt: 'asc' }],
  })
  return rows.map(serializeTemplateConfig)
})

/** 激活中的开具单位（按排序），请求内缓存 */
export const getActiveCertificateCompanies = cache(async (): Promise<CertificateCompanyOption[]> => {
  const rows = await prisma.certificateCompany.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
  })
  return rows.map((row) => ({ id: row.id, name: row.name, stampKey: row.stampKey }))
})

/**
 * 解析模板的可选落款单位：默认单位排第一，其余按配置顺序；单位记录已删除/停用的跳过。
 * 模板未配置可选单位时，回退为单个兜底选项（模板 companyName + 系统默认公章）。
 */
export function resolveTemplateCompanies(
  template: Pick<CertificateTemplateConfig, 'companyName' | 'companyIds' | 'defaultCompanyId'>,
  companies: CertificateCompanyOption[]
): CertificateCompanyOption[] {
  if (template.companyIds.length === 0) {
    return [{ id: null, name: template.companyName, stampKey: null }]
  }
  const byId = new Map(companies.map((company) => [company.id, company]))
  const options: CertificateCompanyOption[] = []
  for (const id of template.companyIds) {
    const company = byId.get(id)
    if (company) options.push(company)
  }
  if (options.length === 0) {
    return [{ id: null, name: template.companyName, stampKey: null }]
  }
  // 默认单位排第一（仅在它确实可用时）
  const defaultIndex = template.defaultCompanyId
    ? options.findIndex((company) => company.id === template.defaultCompanyId)
    : -1
  if (defaultIndex > 0) {
    const [defaultOption] = options.splice(defaultIndex, 1)
    options.unshift(defaultOption)
  }
  return options
}

function toStringRecord(value: Prisma.JsonValue | null): Record<string, string> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  const result: Record<string, string> = {}
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    if (typeof item === 'string' || typeof item === 'number') result[key] = String(item)
  }
  return result
}

type DraftWithTemplate = {
  id: string
  certificateType: CertificateTypeKey
  templateId: string | null
  companyId: string | null
  stampKey: string | null
  name: string | null
  gender: string | null
  startDate: Date | null
  endDate: Date | null
  extraData: Prisma.JsonValue | null
  templateSnapshot: Prisma.JsonValue | null
  companyName: string
  templateMode: string
  status: string
  errorMsg: string | null
  rejectionReason: string | null
  createdAt: Date
  completedAt: Date | null
  issuedAt: Date | null
  rejectedAt: Date | null
  pdfKey: string | null
  officialPdfKey: string | null
  template?: { name: string } | null
}

export function serializeDraft(draft: DraftWithTemplate) {
  return {
    id: draft.id,
    certificateType: draft.certificateType as CertificateTypeKey,
    templateId: draft.templateId,
    templateName: draft.template?.name ?? null,
    companyId: draft.companyId,
    stampKey: draft.stampKey,
    name: draft.name,
    gender: draft.gender,
    startDate: draft.startDate?.toISOString().slice(0, 10) ?? null,
    endDate: draft.endDate?.toISOString().slice(0, 10) ?? null,
    extraData: toStringRecord(draft.extraData),
    companyName: draft.companyName,
    templateMode: draft.templateMode as 'SYSTEM' | 'CUSTOM',
    status: draft.status as 'PROCESSING' | 'COMPLETED' | 'ISSUED' | 'REJECTED' | 'FAILED',
    errorMsg: draft.errorMsg,
    rejectionReason: draft.rejectionReason,
    createdAt: draft.createdAt.toISOString(),
    completedAt: draft.completedAt?.toISOString() ?? null,
    issuedAt: draft.issuedAt?.toISOString() ?? null,
    rejectedAt: draft.rejectedAt?.toISOString() ?? null,
    // 仅开具完毕后提供正式版下载
    downloadUrl:
      draft.status === 'ISSUED' && draft.officialPdfKey
        ? generatePrivateUrl(draft.officialPdfKey)
        : null,
  }
}

/**
 * 生成模板配置的基础证明 PDF（无公章）并上传，状态置为待开具（COMPLETED）。
 * 仅用于 SYSTEM 模板模式；无模板关联的历史草稿走旧版固定模板兜底。
 */
export async function processCertificateDraft(id: string): Promise<void> {
  const draft = await prisma.certificateDraft.findUnique({
    where: { id },
    include: { template: true },
  })
  if (!draft) return

  try {
    let pdf: Buffer
    const config = resolveDraftTemplateConfig(draft)
    if (config) {
      // 落款单位与落款日期分别以草稿快照、模板「落款日期」配置为准
      pdf = await renderDraftPdf(draft, config, new Date())
    } else {
      if (!draft.name || !draft.gender || !draft.idCard || !draft.startDate || !draft.endDate) {
        throw new Error('申请信息不完整，无法生成证明')
      }
      pdf = await generateInternshipCertificatePdf({
        name: draft.name,
        gender: draft.gender,
        idCard: draft.idCard,
        startDate: draft.startDate,
        endDate: draft.endDate,
        companyName: draft.companyName,
      })
    }

    const key = generateInternshipCertificatePdfKey(draft.teacherId)
    const upload = await uploadToQiniu(pdf, key)
    if (!upload.success) throw new Error(upload.error || 'PDF 上传失败')

    await prisma.certificateDraft.update({
      where: { id },
      data: {
        status: 'COMPLETED',
        pdfKey: upload.key,
        errorMsg: null,
        completedAt: new Date(),
        rejectionReason: null,
        rejectedAt: null,
      },
    })
  } catch (error) {
    console.error('[certificate] generation failed:', error)
    await prisma.certificateDraft.update({
      where: { id },
      data: {
        status: 'FAILED',
        errorMsg: error instanceof Error ? error.message : 'PDF 生成失败，请稍后重试',
        completedAt: null,
      },
    }).catch((updateError) => console.error('[certificate] status update failed:', updateError))
  }
}

/**
 * 开具正式证明：在基础 PDF（系统生成或用户上传）上覆盖公章图片并上传。
 * 仅允许对待开具（COMPLETED）的申请执行。
 * 带模板快照的草稿（本次改动后提交的系统模板申请）按快照在开具当天重新渲染，
 * 落款日期因此取真正的开具日；自定义上传与无快照的历史草稿仍使用已生成的基础 PDF。
 */
export async function issueCertificateDraft(
  id: string,
  stampPosition: StampPosition
): Promise<{ success: boolean; error?: string }> {
  const draft = await prisma.certificateDraft.findUnique({ where: { id } })
  if (!draft) return { success: false, error: '申请记录不存在' }
  if (draft.status === 'ISSUED') return { success: false, error: '该证明已开具，请勿重复操作' }
  if (draft.status !== 'COMPLETED') return { success: false, error: '该申请不在待开具状态' }
  if (!draft.pdfKey) return { success: false, error: '基础 PDF 缺失，无法开具' }

  try {
    // 基础 PDF：系统模板按草稿快照在开具当天重新渲染，其它情况沿用已上传的基础 PDF
    const config = parseTemplateSnapshot(draft.templateSnapshot)
    let basePdf: Buffer
    if (config) {
      basePdf = await renderDraftPdf(draft, config, new Date())
    } else {
      const baseRes = await fetch(generatePrivateUrl(draft.pdfKey))
      if (!baseRes.ok) throw new Error('基础 PDF 获取失败')
      basePdf = Buffer.from(await baseRes.arrayBuffer())
    }

    // 盖章图：申请时快照的单位盖章图；无快照（历史申请/自定义上传）用系统默认公章
    let stampImage: Buffer | undefined
    if (draft.stampKey) {
      const stampRes = await fetch(generatePrivateUrl(draft.stampKey))
      if (!stampRes.ok) throw new Error('盖章图片获取失败')
      stampImage = Buffer.from(await stampRes.arrayBuffer())
    }

    // 覆盖公章
    const stamped = await overlayStampOnPdf(basePdf, stampPosition, stampImage)

    const key = generateInternshipCertificateOfficialPdfKey(draft.teacherId)
    const upload = await uploadToQiniu(stamped, key)
    if (!upload.success) throw new Error(upload.error || '正式版 PDF 上传失败')

    await prisma.certificateDraft.update({
      where: { id },
      data: { status: 'ISSUED', officialPdfKey: upload.key, issuedAt: new Date() },
    })
    return { success: true }
  } catch (error) {
    console.error('[certificate] issue failed:', error)
    return { success: false, error: error instanceof Error ? error.message : '开具失败，请稍后重试' }
  }
}

/**
 * 打回证明申请，填写问题说明。被打回后用户可修改后重新提交。
 */
export async function rejectCertificateDraft(
  id: string,
  reason: string
): Promise<{ success: boolean; error?: string }> {
  const reasonTrimmed = reason.trim()
  if (!reasonTrimmed) return { success: false, error: '请填写打回原因' }

  const draft = await prisma.certificateDraft.findUnique({ where: { id } })
  if (!draft) return { success: false, error: '申请记录不存在' }
  if (draft.status !== 'COMPLETED') return { success: false, error: '仅待开具状态的申请可打回' }

  await prisma.certificateDraft.update({
    where: { id },
    data: { status: 'REJECTED', rejectionReason: reasonTrimmed, rejectedAt: new Date() },
  })
  return { success: true }
}

/** 为自定义模板上传 PDF 生成七牛 key。 */
export function buildCustomUploadKey(teacherId: string, fileExt: string): string {
  return generateInternshipCertificateUploadPdfKey(teacherId, fileExt)
}
