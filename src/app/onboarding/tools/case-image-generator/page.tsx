import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { prisma } from '@/lib/prisma'
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
      <div className="mb-8">
        <Link
          href="/onboarding/tools"
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 transition-colors mb-4"
        >
          ← 返回工具列表
        </Link>
        <div className="flex items-center gap-3 mb-2">
          <span className="text-3xl">🎉</span>
          <h1 className="text-2xl font-bold text-gray-900">案例图片生成器</h1>
        </div>
        <p className="text-gray-600">
          选择图片模板，上传案例截图并填写文案，生成可下载的喜报案例图
        </p>
      </div>

      <CaseImageGeneratorClient
        initialRecords={records.map((record) => serializeCaseImageRecord(record))}
      />
    </div>
  )
}
