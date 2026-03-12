import { getOperatorById } from '@/app/actions/adminOperatorActions'
import { notFound } from 'next/navigation'
import { formatDateTime } from '@/lib/utils'
import Link from 'next/link'
import OperatorEditForm from './OperatorEditForm'

export const dynamic = 'force-dynamic'

export default async function OperatorDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const operator = await getOperatorById(id)

  if (!operator) notFound()

  return (
    <div className="max-w-lg">
      <Link
        href="/admin/operators"
        className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6 transition-colors"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        返回列表
      </Link>

      <div className="card mb-4">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-bold text-gray-900">编辑运营人员</h1>
          <span className="badge-primary">{operator._count.teamTeachers} 位团队老师</span>
        </div>
        <div className="text-xs text-gray-400 mb-6">
          ID: {operator.id} · 创建于 {formatDateTime(operator.createdAt)}
        </div>
        <OperatorEditForm operator={operator} />
      </div>
    </div>
  )
}
