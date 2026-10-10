import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { serializeStudentCertificateRecord } from '@/lib/student-certificate-records'
import { serializeCertificateTemplate } from '@/lib/student-certificate-templates'
import StudentCertificateRecordsClient from './StudentCertificateRecordsClient'

export const dynamic = 'force-dynamic'

export default async function StudentCertificateRecordsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const session = (await cookies()).get('admin_session')?.value
  if (!session) redirect('/admin/login')
  let role = ''
  try { role = JSON.parse(session).role } catch { redirect('/admin/login') }
  if (role !== 'super_admin') redirect('/admin/teachers')
  const [{ tab }, records, templates] = await Promise.all([
    searchParams,
    prisma.studentCertificateRecord.findMany({
      orderBy: { createdAt: 'desc' }, take: 500,
      include: { teacher: { select: { name: true, phone: true } } },
    }),
    prisma.studentCertificateTemplate.findMany({ orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }] }),
  ])
  return <StudentCertificateRecordsClient
    initialRecords={records.map(record => serializeStudentCertificateRecord(record, record.teacher))}
    initialTemplates={templates.map(serializeCertificateTemplate)}
    initialTab={tab === 'templates' ? 'templates' : 'records'} />
}
