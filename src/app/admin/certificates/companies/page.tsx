import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { prisma } from '@/lib/prisma'
import { generatePrivateUrl } from '@/lib/qiniu'
import CertificateSubNav from '../CertificateSubNav'
import CertificateCompanyManager from './CertificateCompanyManager'

export const dynamic = 'force-dynamic'

export default async function CertificateCompaniesPage() {
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

  const companies = await prisma.certificateCompany.findMany({
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
  })

  const serialized = companies.map((company) => ({
    id: company.id,
    name: company.name,
    stampKey: company.stampKey,
    // 私有桶生成限时访问链接；无图则前端显示系统默认公章
    stampUrl: company.stampKey ? generatePrivateUrl(company.stampKey) : '/yishenger.png',
    isActive: company.isActive,
    sortOrder: company.sortOrder,
    updatedAt: company.updatedAt.toISOString(),
  }))

  return (
    <>
      <CertificateSubNav active="companies" />
      <CertificateCompanyManager initialCompanies={serialized} />
    </>
  )
}
