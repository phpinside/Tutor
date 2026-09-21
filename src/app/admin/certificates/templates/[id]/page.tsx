import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { prisma } from '@/lib/prisma'
import CertificateSubNav from '../../CertificateSubNav'
import CertificateTemplateForm from '../CertificateTemplateForm'
import { parseCertificateDateMode, parseStringIdList, parseTemplateFields, type CertificateTypeKey } from '@/lib/certificate-template'

export const dynamic = 'force-dynamic'

export default async function CertificateTemplateEditPage({ params }: { params: Promise<{ id: string }> }) {
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

  const { id } = await params
  const companies = await prisma.certificateCompany.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    select: { id: true, name: true },
  })

  if (id === 'new') {
    return (
      <>
        <CertificateSubNav active="templates" />
        <CertificateTemplateForm companies={companies} />
      </>
    )
  }

  const template = await prisma.certificateTemplate.findUnique({ where: { id } })
  if (!template) {
    redirect('/admin/certificates/templates')
  }

  return (
    <>
      <CertificateSubNav active="templates" />
      <CertificateTemplateForm
        templateId={template.id}
        companies={companies}
        initial={{
          type: template.type as CertificateTypeKey,
          name: template.name,
          title: template.title,
          companyName: template.companyName,
          companyIds: parseStringIdList(template.companyIds),
          defaultCompanyId: template.defaultCompanyId,
          bodyText: template.bodyText,
          fields: parseTemplateFields(template.fields),
          dateMode: parseCertificateDateMode(template.dateMode),
          fixedDate: template.fixedDate,
          isActive: template.isActive,
          sortOrder: template.sortOrder,
        }}
      />
    </>
  )
}
