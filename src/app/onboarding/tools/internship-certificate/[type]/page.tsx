import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import CertificateApplyClient from './CertificateApplyClient'
import {
  getActiveCertificateCompanies,
  getActiveCertificateTemplates,
  resolveTemplateCompanies,
  serializeDraft,
} from '@/lib/certificate-service'
import { CERTIFICATE_TYPE_LABELS, type CertificateTypeKey } from '@/lib/certificate-template'

const VALID_TYPES: CertificateTypeKey[] = ['INTERNSHIP', 'LABOR_CONFIRMATION']

const TYPE_META: Record<CertificateTypeKey, { icon: string; description: string }> = {
  INTERNSHIP: {
    icon: '🎓',
    description: '证明你在 AI 伴学项目的实习实践经历与表现，可用于学校实习要求、求职应聘等场景。',
  },
  LABOR_CONFIRMATION: {
    icon: '💼',
    description: '确认你在 AI 伴学项目的劳务服务完成情况与劳务费用结算，可用于劳务报酬申领、费用凭证等场景。',
  },
}

export default async function CertificateTypePage({ params }: { params: Promise<{ type: string }> }) {
  const teacherId = (await cookies()).get('teacherId')?.value
  if (!teacherId) redirect('/auth/login')

  const { type } = await params
  if (!VALID_TYPES.includes(type as CertificateTypeKey)) {
    redirect('/onboarding/tools/internship-certificate')
  }
  const certificateType = type as CertificateTypeKey

  const [teacher, drafts, templates, companies, identity] = await Promise.all([
    prisma.teacher.findUnique({ where: { id: teacherId }, select: { name: true, gender: true } }),
    prisma.certificateDraft.findMany({
      where: { teacherId, certificateType },
      orderBy: { createdAt: 'desc' },
      take: 20,
      include: { template: { select: { name: true } } },
    }),
    getActiveCertificateTemplates(),
    getActiveCertificateCompanies(),
    // 历史申请中的身份信息（跨类型取最近一条），用于表单自动带出
    prisma.certificateDraft.findFirst({
      where: { teacherId, name: { not: null } },
      orderBy: { createdAt: 'desc' },
      select: { name: true, gender: true, idCard: true },
    }),
  ])
  if (!teacher) redirect('/auth/login')

  const typeTemplates = templates
    .filter((template) => template.type === certificateType)
    .map((template) => {
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
    })

  const meta = TYPE_META[certificateType]

  return (
    <div className="animate-fade-in">
      <div className="mb-8">
        <a href="/onboarding/tools/internship-certificate" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 transition-colors mb-4">
          ← 返回证明开具
        </a>
        <div className="flex items-center gap-3 mb-2">
          <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-50 text-2xl">{meta.icon}</span>
          <h1 className="text-2xl font-bold text-gray-900">{CERTIFICATE_TYPE_LABELS[certificateType]}</h1>
        </div>
        <p className="text-gray-600">{meta.description}</p>
      </div>

      <CertificateApplyClient
        teacherId={teacherId}
        certificateType={certificateType}
        initialName={teacher.name ?? ''}
        initialGender={teacher.gender ?? ''}
        initialIdentity={{
          name: identity?.name ?? null,
          gender: identity?.gender ?? null,
          idCard: identity?.idCard ?? null,
        }}
        initialDrafts={drafts.map(serializeDraft)}
        templates={typeTemplates}
      />
    </div>
  )
}
