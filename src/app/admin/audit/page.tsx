import { getAuditLogs } from '@/app/actions/auditLogActions'
import { formatDateTime } from '@/lib/utils'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

export default async function AuditLogPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; action?: string }>
}) {
  const params = await searchParams
  const page = params.page ? parseInt(params.page) : 1
  const actionFilter = params.action?.trim() || undefined
  const result = await getAuditLogs(page, 50, actionFilter)

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">审计日志</h1>
          <p className="text-sm text-gray-500 mt-1">
            {result.success ? `共 ${result.total} 条记录（每页 50 条）` : (result.error ?? '')}
          </p>
        </div>
        <form method="get" className="flex gap-2">
          <input
            name="action"
            defaultValue={actionFilter ?? ''}
            placeholder="按动作筛选，如 FINAL_REVIEW"
            className="input w-64"
          />
          <button type="submit" className="btn-primary">
            筛选
          </button>
          <Link href="/admin/audit" className="btn-secondary">
            重置
          </Link>
        </form>
      </div>

      {result.success && result.logs && result.logs.length > 0 ? (
        <div className="card overflow-hidden p-0">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">时间</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">操作者</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">动作</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">对象</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">详情</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {result.logs.map((log) => (
                <tr key={log.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                    {formatDateTime(log.createdAt)}
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-gray-900 font-medium">{log.actorName || log.actorId}</span>
                    <span className="ml-1 text-xs text-gray-400">({log.actorType})</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="badge-primary text-xs">{log.action}</span>
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs">
                    {log.targetType ? `${log.targetType}:${log.targetId?.substring(0, 12)}…` : '—'}
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs max-w-md truncate">
                    {log.detail ? JSON.stringify(log.detail) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="card text-center py-16">
          <div className="text-4xl mb-3">📋</div>
          <p className="text-gray-500">{result.success ? '暂无审计记录' : (result.error ?? '')}</p>
        </div>
      )}

      {/* 分页 */}
      {result.success && result.totalPages && result.totalPages > 1 && (
        <div className="flex justify-center gap-2 mt-6">
          {page > 1 && (
            <Link
              href={`/admin/audit?page=${page - 1}${actionFilter ? `&action=${encodeURIComponent(actionFilter)}` : ''}`}
              className="btn-outline px-4 py-2"
            >
              上一页
            </Link>
          )}
          <span className="px-4 py-2 text-sm text-gray-500">
            {page} / {result.totalPages}
          </span>
          {page < result.totalPages && (
            <Link
              href={`/admin/audit?page=${page + 1}${actionFilter ? `&action=${encodeURIComponent(actionFilter)}` : ''}`}
              className="btn-outline px-4 py-2"
            >
              下一页
            </Link>
          )}
        </div>
      )}
    </div>
  )
}
