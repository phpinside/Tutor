import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import InternshipCertificateClient from './InternshipCertificateClient'
import {
  getActiveCertificateCompanies,
  getActiveCertificateTemplates,
  resolveTemplateCompanies,
  serializeDraft,
} from '@/lib/certificate-service'

export default async function InternshipCertificatePage() {
  const teacherId = (await cookies()).get('teacherId')?.value
  if (!teacherId) redirect('/auth/login')

  const [teacher, drafts, templates, companies] = await Promise.all([
    prisma.teacher.findUnique({ where: { id: teacherId }, select: { name: true, gender: true } }),
    prisma.certificateDraft.findMany({
      where: { teacherId },
      orderBy: { createdAt: 'desc' },
      take: 20,
      include: { template: { select: { name: true } } },
    }),
    getActiveCertificateTemplates(),
    getActiveCertificateCompanies(),
  ])
  if (!teacher) redirect('/auth/login')

  return (
    <div className="animate-fade-in">
      <div className="mb-8">
        <Link href="/onboarding/tools" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 transition-colors mb-4">
          ← 返回工具列表
        </Link>
        <div className="flex items-center gap-3 mb-2">
          <span className="text-3xl">📄</span>
          <h1 className="text-2xl font-bold text-gray-900">证明开具</h1>
        </div>
        <p className="text-gray-600">实习证明、劳务完成确认单在线申请：系统模板填写信息生成，或上传自定义 PDF，单位审核盖章后下载正式文件。</p>
      </div>

      <InternshipCertificateClient
        teacherId={teacherId}
        initialName={teacher.name ?? ''}
        initialGender={teacher.gender ?? ''}
        initialDrafts={drafts.map(serializeDraft)}
        templates={templates.map((template) => {
          const options = resolveTemplateCompanies(template, companies)
          return {
            id: template.id,
            type: template.type,
            name: template.name,
            title: template.title,
            fields: template.fields,
            companies: options.map((option) => ({ id: option.id, name: option.name })),
            defaultCompanyId: options[0]?.id ?? null,
          }
        })}
      />
    </div>
  )
}
