import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { prisma } from '@/lib/prisma'
import CertificateSubNav from '../CertificateSubNav'
import CertificateTemplateListClient from './CertificateTemplateListClient'

export const dynamic = 'force-dynamic'

export default async function CertificateTemplatesPage() {
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

  const templates = await prisma.certificateTemplate.findMany({
    orderBy: [{ type: 'asc' }, { sortOrder: 'asc' }, { createdAt: 'asc' }],
  })

  const serialized = templates.map((template) => {
    const fields = Array.isArray(template.fields) ? (template.fields as unknown[]).length : 0
    return {
      id: template.id,
      type: template.type as 'INTERNSHIP' | 'LABOR_CONFIRMATION',
      name: template.name,
      title: template.title,
      companyName: template.companyName,
      fieldCount: fields,
      isActive: template.isActive,
      sortOrder: template.sortOrder,
      updatedAt: template.updatedAt.toISOString(),
    }
  })

  return (
    <>
      <CertificateSubNav active="templates" />
      <CertificateTemplateListClient initialTemplates={serialized} />
    </>
  )
}
