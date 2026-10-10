import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { serializeCertificateTemplate } from '@/lib/student-certificate-templates'
import StudentCertificateTemplateEditor from '../StudentCertificateTemplateEditor'

export const dynamic = 'force-dynamic'

export default async function StudentCertificateTemplateEditPage({ params }: { params: Promise<{ id: string }> }) {
  const session = (await cookies()).get('admin_session')?.value
  if (!session) redirect('/admin/login')
  try { if (JSON.parse(session).role !== 'super_admin') redirect('/admin/teachers') } catch { redirect('/admin/login') }
  const { id } = await params
  const row = id === 'new' ? null : await prisma.studentCertificateTemplate.findUnique({ where: { id } })
  if (id !== 'new' && !row) redirect('/admin/student-certificate-records?tab=templates')
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Shanghai' })
  return <StudentCertificateTemplateEditor initial={row ? serializeCertificateTemplate(row) : null} today={today} />
}
