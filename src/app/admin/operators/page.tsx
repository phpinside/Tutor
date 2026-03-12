import { getOperators } from '@/app/actions/adminOperatorActions'
import { formatDateTime } from '@/lib/utils'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

export default async function OperatorsPage() {
  const operators = await getOperators()

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">运营人员管理</h1>
          <p className="text-sm text-gray-500 mt-1">共 {operators.length} 名运营人员</p>
        </div>
        <Link
          href="/admin/operators/new"
          className="btn-primary"
        >
          + 新增运营人员
        </Link>
      </div>

      {operators.length === 0 ? (
        <div className="card text-center py-16">
          <div className="text-4xl mb-3">👤</div>
          <p className="text-gray-500 mb-4">暂无运营人员</p>
          <Link href="/admin/operators/new" className="btn-primary inline-block">
            新增第一位运营人员
          </Link>
        </div>
      ) : (
        <div className="card overflow-hidden p-0">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">姓名</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">手机号</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">状态</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">团队人数</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">备注</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">创建时间</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {operators.map((op) => (
                <tr key={op.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 font-medium text-gray-900">{op.name}</td>
                  <td className="px-4 py-3 text-gray-600">{op.phone}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                      op.isEnabled
                        ? 'bg-green-100 text-green-700'
                        : 'bg-gray-100 text-gray-500'
                    }`}>
                      {op.isEnabled ? '启用' : '禁用'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="badge-primary">{op._count.teamTeachers} 人</span>
                  </td>
                  <td className="px-4 py-3 text-gray-500 max-w-xs truncate">
                    {op.remarks || '—'}
                  </td>
                  <td className="px-4 py-3 text-gray-500">{formatDateTime(op.createdAt)}</td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/operators/${op.id}`}
                      className="text-blue-600 hover:text-blue-800 font-medium"
                    >
                      编辑
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
