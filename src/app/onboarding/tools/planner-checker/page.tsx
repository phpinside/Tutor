import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import PlannerCheckerClient from './PlannerCheckerClient'
import { prisma } from '@/lib/prisma'

export default async function PlannerCheckerPage() {
  const cookieStore = await cookies()
  const teacherId = cookieStore.get('teacherId')?.value

  if (!teacherId) {
    redirect('/auth/login')
  }

  const records = await prisma.plannerCheckRecord.findMany({
    where: { teacherId },
    orderBy: { createdAt: 'desc' },
    take: 10,
    select: {
      id: true,
      fileName: true,
      status: true,
      result: true,
      errorMsg: true,
      createdAt: true,
    },
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
          <span className="text-3xl">📋</span>
          <h1 className="text-2xl font-bold text-gray-900">规划书自查器</h1>
        </div>
        <p className="text-gray-600">
          上传规划书（PDF 格式），系统将自动分析并给出存在的问题和改进建议
        </p>
      </div>

      <PlannerCheckerClient
        teacherId={teacherId}
        initialRecords={records.map(r => ({
          ...r,
          createdAt: r.createdAt.toISOString(),
        }))}
      />
    </div>
  )
}
