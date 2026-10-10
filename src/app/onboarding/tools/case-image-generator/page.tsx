import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import ImageToolsTabHeader from '@/components/tools/ImageToolsTabHeader'
import { serializeCaseImageRecord } from '@/lib/case-image-records'
import CaseImageGeneratorClient from './CaseImageGeneratorClient'

export const dynamic = 'force-dynamic'

export default async function CaseImageGeneratorPage() {
  const cookieStore = await cookies()
  const teacherId = cookieStore.get('teacherId')?.value

  if (!teacherId) {
    redirect('/auth/login')
  }

  const records = await prisma.caseImageRecord.findMany({
    where: { teacherId },
    orderBy: { createdAt: 'desc' },
    take: 50,
  })

  return (
    <div className="animate-fade-in">
      <ImageToolsTabHeader activeHref="/onboarding/tools/case-image-generator" />

      <CaseImageGeneratorClient
        initialRecords={records.map((record) => serializeCaseImageRecord(record))}
      />
    </div>
  )
}
