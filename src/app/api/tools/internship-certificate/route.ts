import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { prisma } from '@/lib/prisma'
import {
  isValidChineseIdCard,
  processInternshipCertificateDraft,
  serializeDraft,
} from '@/lib/internship-certificate-service'

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
    const templateMode = (body.templateMode === 'CUSTOM' ? 'CUSTOM' : 'SYSTEM') as TemplateMode

    if (!(await prisma.teacher.findUnique({ where: { id: teacherId }, select: { id: true } }))) {
      return NextResponse.json({ error: '用户不存在' }, { status: 404 })
    }

    // 同一时间仅允许生成一份，已完成、已开具和被打回的记录均保留为历史记录。
    const processingDraft = await prisma.internshipCertificateDraft.findFirst({
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
      const name = typeof body.name === 'string' ? body.name.trim() : ''
      const gender = typeof body.gender === 'string' ? body.gender.trim() : ''
      const idCard = typeof body.idCard === 'string' ? body.idCard.trim().toUpperCase() : ''
      const startDate = parseDate(body.startDate)
      const endDate = parseDate(body.endDate)

      if (!name || !gender || !idCard || !startDate || !endDate) {
        return NextResponse.json({ error: '请完整填写申请信息' }, { status: 400 })
      }
      if (!isValidChineseIdCard(idCard)) {
        return NextResponse.json({ error: '身份证号格式不正确' }, { status: 400 })
      }
      if (startDate > endDate) {
        return NextResponse.json({ error: '实习开始日期不能晚于结束日期' }, { status: 400 })
      }

      const draft = await prisma.internshipCertificateDraft.create({
        data: {
          teacherId,
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

      void processInternshipCertificateDraft(draft.id)
      return NextResponse.json({ draft: serializeDraft(draft) }, { status: 202 })
    }

    // 自定义模板：用户上传 PDF
    const pdfKey = typeof body.pdfKey === 'string' ? body.pdfKey.trim() : ''
    if (!pdfKey) {
      return NextResponse.json({ error: '请先上传实习证明 PDF' }, { status: 400 })
    }

    const draft = await prisma.internshipCertificateDraft.create({
      data: {
        teacherId,
        companyName: COMPANY_NAME,
        templateMode: 'CUSTOM',
        status: 'COMPLETED',
        pdfKey,
        completedAt: new Date(),
      },
    })

    return NextResponse.json({ draft: serializeDraft(draft) }, { status: 202 })
  } catch (error) {
    console.error('[internship-certificate POST]', error)
    return NextResponse.json({ error: '提交失败，请稍后重试' }, { status: 500 })
  }
}
