import { prisma } from '@/lib/prisma'
import {
  uploadToQiniu,
  generateInternshipCertificatePdfKey,
  generateInternshipCertificateOfficialPdfKey,
  generateInternshipCertificateUploadPdfKey,
  generatePrivateUrl,
} from '@/lib/qiniu'
import { generateInternshipCertificatePdf } from '@/lib/internship-certificate'
import { overlayStampOnPdf, type StampPosition } from '@/lib/pdf-stamp'

export function isValidChineseIdCard(value: string): boolean {
  return /^\d{17}[\dXx]$/.test(value)
}

export function serializeDraft(draft: {
  id: string
  name: string | null
  gender: string | null
  startDate: Date | null
  endDate: Date | null
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
}) {
  return {
    id: draft.id,
    name: draft.name,
    gender: draft.gender,
    startDate: draft.startDate?.toISOString().slice(0, 10) ?? null,
    endDate: draft.endDate?.toISOString().slice(0, 10) ?? null,
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
 * 生成系统默认模板的实习证明基础 PDF（无公章）并上传，状态置为待开具（COMPLETED）。
 * 仅用于 SYSTEM 模板模式。
 */
export async function processInternshipCertificateDraft(id: string): Promise<void> {
  const draft = await prisma.internshipCertificateDraft.findUnique({ where: { id } })
  if (!draft) return

  try {
    if (!draft.name || !draft.gender || !draft.idCard || !draft.startDate || !draft.endDate) {
      throw new Error('申请信息不完整，无法生成证明')
    }
    const pdf = await generateInternshipCertificatePdf({
      name: draft.name,
      gender: draft.gender,
      idCard: draft.idCard,
      startDate: draft.startDate,
      endDate: draft.endDate,
      companyName: draft.companyName,
    })
    const key = generateInternshipCertificatePdfKey(draft.teacherId)
    const upload = await uploadToQiniu(pdf, key)
    if (!upload.success) throw new Error(upload.error || 'PDF 上传失败')

    await prisma.internshipCertificateDraft.update({
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
    console.error('[internship-certificate] generation failed:', error)
    await prisma.internshipCertificateDraft.update({
      where: { id },
      data: {
        status: 'FAILED',
        errorMsg: error instanceof Error ? error.message : 'PDF 生成失败，请稍后重试',
        completedAt: null,
      },
    }).catch((updateError) => console.error('[internship-certificate] status update failed:', updateError))
  }
}

/**
 * 开具正式实习证明：在基础 PDF（系统生成或用户上传）上覆盖公章图片并上传。
 * 仅允许对待开具（COMPLETED）的申请执行。
 */
export async function issueInternshipCertificateDraft(
  id: string,
  stampPosition: StampPosition
): Promise<{ success: boolean; error?: string }> {
  const draft = await prisma.internshipCertificateDraft.findUnique({ where: { id } })
  if (!draft) return { success: false, error: '申请记录不存在' }
  if (draft.status === 'ISSUED') return { success: false, error: '该证明已开具，请勿重复操作' }
  if (draft.status !== 'COMPLETED') return { success: false, error: '该申请不在待开具状态' }
  if (!draft.pdfKey) return { success: false, error: '基础 PDF 缺失，无法开具' }

  try {
    // 拉取基础 PDF
    const baseUrl = generatePrivateUrl(draft.pdfKey)
    const baseRes = await fetch(baseUrl)
    if (!baseRes.ok) throw new Error('基础 PDF 获取失败')
    const basePdf = Buffer.from(await baseRes.arrayBuffer())

    // 覆盖公章
    const stamped = await overlayStampOnPdf(basePdf, stampPosition)

    const key = generateInternshipCertificateOfficialPdfKey(draft.teacherId)
    const upload = await uploadToQiniu(stamped, key)
    if (!upload.success) throw new Error(upload.error || '正式版 PDF 上传失败')

    await prisma.internshipCertificateDraft.update({
      where: { id },
      data: { status: 'ISSUED', officialPdfKey: upload.key, issuedAt: new Date() },
    })
    return { success: true }
  } catch (error) {
    console.error('[internship-certificate] issue failed:', error)
    return { success: false, error: error instanceof Error ? error.message : '开具失败，请稍后重试' }
  }
}

/**
 * 打回实习证明申请，填写问题说明。被打回后用户可修改后重新提交。
 */
export async function rejectInternshipCertificateDraft(
  id: string,
  reason: string
): Promise<{ success: boolean; error?: string }> {
  const reasonTrimmed = reason.trim()
  if (!reasonTrimmed) return { success: false, error: '请填写打回原因' }

  const draft = await prisma.internshipCertificateDraft.findUnique({ where: { id } })
  if (!draft) return { success: false, error: '申请记录不存在' }
  if (draft.status !== 'COMPLETED') return { success: false, error: '仅待开具状态的申请可打回' }

  await prisma.internshipCertificateDraft.update({
    where: { id },
    data: { status: 'REJECTED', rejectionReason: reasonTrimmed, rejectedAt: new Date() },
  })
  return { success: true }
}

/** 为自定义模板上传 PDF 生成七牛 key。 */
export function buildCustomUploadKey(teacherId: string, fileExt: string): string {
  return generateInternshipCertificateUploadPdfKey(teacherId, fileExt)
}
