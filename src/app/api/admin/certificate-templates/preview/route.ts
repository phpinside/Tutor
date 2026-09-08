import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { generateCertificatePdf } from '@/lib/certificate-pdf'
import { isSuperAdmin } from '@/lib/admin-auth'
import { buildSamplePlaceholderValues, parseTemplateFields, type CertificateTemplateConfig, type CertificateTypeKey } from '@/lib/certificate-template'

/** 管理端模板预览：用示例数据把模板渲染为 PDF，供配置时检查版式与占位符。 */
export async function POST(request: NextRequest) {
  if (!(await isSuperAdmin())) {
    return NextResponse.json({ error: '仅超级管理员可预览模板' }, { status: 403 })
  }

  try {
    const body = await request.json() as Record<string, unknown>
    const title = typeof body.title === 'string' ? body.title.trim() : ''
    const companyName = typeof body.companyName === 'string' ? body.companyName.trim() : ''
    const bodyText = typeof body.bodyText === 'string' ? body.bodyText : ''
    if (!title || !companyName || !bodyText.trim()) {
      return NextResponse.json({ error: '请先完整填写标题、单位名称与正文' }, { status: 400 })
    }

    const config: CertificateTemplateConfig = {
      id: 'preview',
      type: (body.type === 'LABOR_CONFIRMATION' ? 'LABOR_CONFIRMATION' : 'INTERNSHIP') as CertificateTypeKey,
      name: '预览',
      title,
      companyName,
      companyIds: [],
      defaultCompanyId: null,
      bodyText,
      fields: parseTemplateFields(body.fields),
      isActive: true,
      sortOrder: 0,
    }

    const pdf = await generateCertificatePdf(config, buildSamplePlaceholderValues(config))

    return new NextResponse(new Uint8Array(pdf), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'inline; filename="certificate-template-preview.pdf"',
        'Cache-Control': 'no-store',
      },
    })
  } catch (error) {
    console.error('[certificate-template preview]', error)
    return NextResponse.json({ error: '预览生成失败，请检查模板配置' }, { status: 500 })
  }
}
