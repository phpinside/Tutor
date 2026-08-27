import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { prisma } from '@/lib/prisma'
import { generatePrivateUrl } from '@/lib/qiniu'
import InternshipCertificateManagementClient from './InternshipCertificateManagementClient'

export const dynamic = 'force-dynamic'

export default async function InternshipCertificatesManagementPage() {
  // 仅超级管理员可访问
  const cookieStore = await cookies()
  const adminSession = cookieStore.get('admin_session')

  if (!adminSession) {
    redirect('/admin/login')
  }

  try {
    const data = JSON.parse(adminSession.value)
    if (data.role !== 'super_admin') {
      redirect('/admin/teachers')
    }
  } catch {
    redirect('/admin/login')
  }

  const drafts = await prisma.internshipCertificateDraft.findMany({
    orderBy: { updatedAt: 'desc' },
    include: {
      teacher: { select: { id: true, name: true, phone: true } },
    },
  })

  const serialized = drafts.map((draft) => ({
    id: draft.id,
    teacherId: draft.teacherId,
    teacherName: draft.teacher.name ?? '未填写',
    teacherPhone: draft.teacher.phone ?? '-',
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
    downloadUrl:
      draft.status === 'ISSUED' && draft.officialPdfKey
        ? generatePrivateUrl(draft.officialPdfKey)
        : null,
  }))

  return <InternshipCertificateManagementClient initialDrafts={serialized} />
}
