import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import InternshipCertificateClient from './InternshipCertificateClient'
import { serializeDraft } from '@/lib/internship-certificate-service'

export default async function InternshipCertificatePage() {
  const teacherId = (await cookies()).get('teacherId')?.value
  if (!teacherId) redirect('/auth/login')

  const [teacher, drafts] = await Promise.all([
    prisma.teacher.findUnique({ where: { id: teacherId }, select: { name: true, gender: true } }),
    prisma.internshipCertificateDraft.findMany({ where: { teacherId }, orderBy: { createdAt: 'desc' }, take: 20 }),
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
          <h1 className="text-2xl font-bold text-gray-900">实习证明草稿</h1>
        </div>
        <p className="text-gray-600">填写信息后生成带“草稿 / 待审核盖章”水印的 PDF，供单位审核使用。</p>
      </div>

      <InternshipCertificateClient
        teacherId={teacherId}
        initialName={teacher.name ?? ''}
        initialGender={teacher.gender ?? ''}
        initialDrafts={drafts.map(serializeDraft)}
      />
    </div>
  )
}
