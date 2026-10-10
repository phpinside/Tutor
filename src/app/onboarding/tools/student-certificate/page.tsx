import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import ImageToolsTabHeader from '@/components/tools/ImageToolsTabHeader'
import { serializeStudentCertificateRecord } from '@/lib/student-certificate-records'
import { serializeCertificateTemplate } from '@/lib/student-certificate-templates'
import StudentCertificateClient from './StudentCertificateClient'

export const dynamic = 'force-dynamic'

export default async function StudentCertificatePage() {
  const teacherId = (await cookies()).get('teacherId')?.value
  if (!teacherId) redirect('/auth/login')
  const [records, templates] = await Promise.all([
    prisma.studentCertificateRecord.findMany({ where: { teacherId }, orderBy: { createdAt: 'desc' }, take: 30 }),
    prisma.studentCertificateTemplate.findMany({ where: { isActive: true, archivedAt: null }, orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }] }),
  ])
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Shanghai' })
  return (
    <div className="animate-fade-in pb-10">
      <ImageToolsTabHeader activeHref="/onboarding/tools/student-certificate" />
      <StudentCertificateClient today={today} initialRecords={records.map(record => serializeStudentCertificateRecord(record))} templates={templates.map(serializeCertificateTemplate)} />
    </div>
  )
}
