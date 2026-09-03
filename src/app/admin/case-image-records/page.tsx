import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { prisma } from '@/lib/prisma'
import { serializeCaseImageRecord } from '@/lib/case-image-records'
import CaseImageRecordManagementClient from './CaseImageRecordManagementClient'

export const dynamic = 'force-dynamic'

export default async function CaseImageRecordsManagementPage() {
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

  const records = await prisma.caseImageRecord.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      teacher: { select: { id: true, name: true, phone: true } },
    },
  })

  const serialized = records.map((record) =>
    serializeCaseImageRecord(record, record.teacher)
  )

  return <CaseImageRecordManagementClient initialRecords={serialized} />
}
