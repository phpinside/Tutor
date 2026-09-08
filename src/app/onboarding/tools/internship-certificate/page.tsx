import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { getActiveCertificateTemplates } from '@/lib/certificate-service'
import { CERTIFICATE_TYPE_LABELS, type CertificateTypeKey } from '@/lib/certificate-template'

/** 证明类型导航卡片（展示文案为产品配置，模板内容在管理端维护） */
const TYPE_CARDS: { type: CertificateTypeKey; icon: string; description: string }[] = [
  {
    type: 'INTERNSHIP',
    icon: '🎓',
    description: '证明你在 AI 伴学项目的实习实践经历与表现，可用于学校实习要求、求职应聘等场景。',
  },
  {
    type: 'LABOR_CONFIRMATION',
    icon: '💼',
    description: '确认你在 AI 伴学项目的劳务服务完成情况与劳务费用结算，可用于劳务报酬申领、费用凭证等场景。',
  },
]

export default async function InternshipCertificatePage() {
  const teacherId = (await cookies()).get('teacherId')?.value
  if (!teacherId) redirect('/auth/login')

  const [teacher, templates] = await Promise.all([
    prisma.teacher.findUnique({ where: { id: teacherId }, select: { id: true } }),
    getActiveCertificateTemplates(),
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
        <p className="text-gray-600">选择要开具的证明类型，填写信息生成草稿或上传自定义 PDF，单位审核盖章后即可下载正式文件。</p>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        {TYPE_CARDS.map(({ type, icon, description }) => {
          const templateCount = templates.filter((template) => template.type === type).length
          return (
            <Link
              key={type}
              href={`/onboarding/tools/internship-certificate/${type}`}
              className="group rounded-xl border-2 border-gray-200 bg-white p-6 transition-all hover:-translate-y-0.5 hover:border-indigo-400 hover:shadow-md"
            >
              <div className="flex items-start gap-4">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-3xl">{icon}</div>
                <div className="min-w-0">
                  <h2 className="text-lg font-semibold text-gray-900">{CERTIFICATE_TYPE_LABELS[type]}</h2>
                  <p className="mt-1.5 text-sm leading-relaxed text-gray-600">{description}</p>
                </div>
              </div>
              <div className="mt-5 flex items-center justify-between">
                <span className="text-xs text-gray-500">
                  {templateCount > 0 ? `${templateCount} 个系统模板可直接填写 · 支持自定义上传` : '支持自定义上传 PDF'}
                </span>
                <span className="inline-flex items-center gap-1 text-sm font-medium text-indigo-600">
                  立即申请
                  <span aria-hidden className="transition-transform group-hover:translate-x-0.5">→</span>
                </span>
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
