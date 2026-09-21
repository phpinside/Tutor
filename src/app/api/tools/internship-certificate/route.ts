import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { prisma } from '@/lib/prisma'
import {
  getActiveCertificateCompanies,
  processCertificateDraft,
  resolveTemplateCompanies,
  serializeDraft,
  serializeTemplateConfig,
  toTemplateSnapshot,
} from '@/lib/certificate-service'
import { validateTemplateInput, type CertificateTypeKey } from '@/lib/certificate-template'

const COMPANY_NAME = '北京一生二科技有限公司'

function parseDate(value: unknown): Date | null {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const date = new Date(`${value}T00:00:00.000Z`)
  return Number.isNaN(date.getTime()) ? null : date
}

type TemplateMode = 'SYSTEM' | 'CUSTOM'

export async function POST(request: NextRequest) {
  try {
    const teacherId = (await cookies()).get('teacherId')?.value
    if (!teacherId) return NextResponse.json({ error: '请先登录' }, { status: 401 })

    const body = await request.json() as Record<string, unknown>
    const certificateType: CertificateTypeKey = body.certificateType === 'LABOR_CONFIRMATION' ? 'LABOR_CONFIRMATION' : 'INTERNSHIP'
    const templateMode = (body.templateMode === 'CUSTOM' ? 'CUSTOM' : 'SYSTEM') as TemplateMode

    if (!(await prisma.teacher.findUnique({ where: { id: teacherId }, select: { id: true } }))) {
      return NextResponse.json({ error: '用户不存在' }, { status: 404 })
    }

    // 同一时间仅允许生成一份，已完成、已开具和被打回的记录均保留为历史记录。
    const processingDraft = await prisma.certificateDraft.findFirst({
      where: { teacherId, status: 'PROCESSING' },
      orderBy: { createdAt: 'desc' },
    })
    if (processingDraft) {
      return NextResponse.json(
        { error: '已有草稿正在生成，请完成后再提交新的申请', draft: serializeDraft(processingDraft) },
        { status: 409 }
      )
    }

    if (templateMode === 'SYSTEM') {
      // 解析模板：优先按 templateId，缺失时回退该类型下排序最前的激活模板（兼容旧请求）
      let template = null
      if (typeof body.templateId === 'string' && body.templateId.trim()) {
        template = await prisma.certificateTemplate.findFirst({
          where: { id: body.templateId.trim(), type: certificateType, isActive: true },
        })
        if (!template) return NextResponse.json({ error: '所选模板不存在或已停用' }, { status: 400 })
      } else {
        template = await prisma.certificateTemplate.findFirst({
          where: { type: certificateType, isActive: true },
          orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
        })
      }

      const data = (body.data && typeof body.data === 'object' && !Array.isArray(body.data)
        ? body.data
        : body) as Record<string, unknown>

      if (template) {
        const config = serializeTemplateConfig(template)
        const validated = validateTemplateInput(config, data)
        if (!validated.ok) {
          return NextResponse.json({ error: validated.error }, { status: 400 })
        }

        // 落款单位：模板多选单位时用户可指定；默认取第一项（默认单位排最前）
        const companyOptions = resolveTemplateCompanies(config, await getActiveCertificateCompanies())
        const requestedCompanyId = typeof body.companyId === 'string' ? body.companyId : ''
        const chosenCompany =
          companyOptions.find((option) => option.id === requestedCompanyId) ?? companyOptions[0]
        if (requestedCompanyId && !chosenCompany) {
          return NextResponse.json({ error: '所选开具单位不在该模板可选范围内' }, { status: 400 })
        }

        const draft = await prisma.certificateDraft.create({
          data: {
            teacherId,
            certificateType,
            templateId: template.id,
            companyId: chosenCompany?.id ?? null,
            stampKey: chosenCompany?.stampKey ?? null,
            name: validated.data.name,
            gender: validated.data.gender,
            idCard: validated.data.idCard,
            startDate: validated.data.startDate,
            endDate: validated.data.endDate,
            extraData: validated.data.extraData,
            companyName: chosenCompany?.name ?? template.companyName,
            templateMode: 'SYSTEM',
            // 提交时的模板快照：开具时按快照重新渲染，避免期间改模板导致串版
            templateSnapshot: toTemplateSnapshot(config),
            status: 'PROCESSING',
          },
        })

        void processCertificateDraft(draft.id)
        return NextResponse.json({ draft: serializeDraft(draft) }, { status: 202 })
      }

      // 类型下没有任何模板：仅实习证明走旧版固定模板兜底
      if (certificateType !== 'INTERNSHIP') {
        return NextResponse.json({ error: '该证明类型暂无可用模板' }, { status: 400 })
      }

      const name = typeof data.name === 'string' ? data.name.trim() : ''
      const gender = typeof data.gender === 'string' ? data.gender.trim() : ''
      const idCard = typeof data.idCard === 'string' ? data.idCard.trim().toUpperCase() : ''
      const startDate = parseDate(data.startDate)
      const endDate = parseDate(data.endDate)

      if (!name || !gender || !idCard || !startDate || !endDate) {
        return NextResponse.json({ error: '请完整填写申请信息' }, { status: 400 })
      }
      if (!/^\d{17}[\dXx]$/.test(idCard)) {
        return NextResponse.json({ error: '身份证号格式不正确' }, { status: 400 })
      }
      if (startDate > endDate) {
        return NextResponse.json({ error: '实习开始日期不能晚于结束日期' }, { status: 400 })
      }

      const draft = await prisma.certificateDraft.create({
        data: {
          teacherId,
          certificateType,
          name,
          gender,
          idCard,
          startDate,
          endDate,
          companyName: COMPANY_NAME,
          templateMode: 'SYSTEM',
          status: 'PROCESSING',
        },
      })

      void processCertificateDraft(draft.id)
      return NextResponse.json({ draft: serializeDraft(draft) }, { status: 202 })
    }

    // 自定义模板：用户上传 PDF
    const pdfKey = typeof body.pdfKey === 'string' ? body.pdfKey.trim() : ''
    if (!pdfKey) {
      return NextResponse.json({ error: '请先上传证明 PDF' }, { status: 400 })
    }

    const draft = await prisma.certificateDraft.create({
      data: {
        teacherId,
        certificateType,
        companyName: COMPANY_NAME,
        templateMode: 'CUSTOM',
        status: 'COMPLETED',
        pdfKey,
        completedAt: new Date(),
      },
    })

    return NextResponse.json({ draft: serializeDraft(draft) }, { status: 202 })
  } catch (error) {
    console.error('[certificate POST]', error)
    return NextResponse.json({ error: '提交失败，请稍后重试' }, { status: 500 })
  }
}
