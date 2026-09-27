import { getOperators } from '@/app/actions/adminOperatorActions'
import { formatDateTime } from '@/lib/utils'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

const ROLE_LABELS: Record<string, string> = {
  LEARNER_MANAGER: '学管',
  OPERATOR: '运营',
}

const ROLE_BADGE_CLASSES: Record<string, string> = {
  LEARNER_MANAGER: 'bg-blue-100 text-blue-700',
  OPERATOR: 'bg-amber-100 text-amber-700',
}

export default async function OperatorsPage({
  searchParams,
}: {
  searchParams: Promise<{ name?: string; phone?: string; role?: string; status?: string }>
}) {
  const params = await searchParams
  const filters = {
    name: params.name?.trim() || undefined,
    phone: params.phone?.trim() || undefined,
    role: params.role || undefined,
    isEnabled:
      params.status === 'enabled' ? true : params.status === 'disabled' ? false : undefined,
  }
  const operators = await getOperators(filters)

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">学管 / 运营人员管理</h1>
          <p className="text-sm text-gray-500 mt-1">
            共 {operators.length} 名人员{filters.name || filters.phone || filters.role || filters.isEnabled !== undefined ? '（筛选结果）' : ''} ·
            学管仅能查看自己管辖范围内的老师，运营可查看全部老师数据
          </p>
        </div>
        <Link
          href="/admin/operators/new"
          className="btn-primary"
        >
          + 新增人员
        </Link>
      </div>

      {/* 筛选栏 */}
      <form method="get" className="card mb-6 p-4 grid gap-3 md:grid-cols-5 items-end">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">姓名</label>
          <input
            name="name"
            defaultValue={filters.name ?? ''}
            placeholder="按姓名搜索"
            className="input w-full"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">手机号</label>
          <input
            name="phone"
            defaultValue={filters.phone ?? ''}
            placeholder="按手机号搜索"
            className="input w-full"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">角色</label>
          <select name="role" defaultValue={filters.role ?? ''} className="input w-full">
            <option value="">全部角色</option>
            <option value="LEARNER_MANAGER">学管</option>
            <option value="OPERATOR">运营</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">状态</label>
          <select name="status" defaultValue={params.status ?? ''} className="input w-full">
            <option value="">全部状态</option>
            <option value="enabled">启用</option>
            <option value="disabled">禁用</option>
          </select>
        </div>
        <div className="flex gap-2">
          <button type="submit" className="btn-primary flex-1">
            筛选
          </button>
          <Link href="/admin/operators" className="btn-secondary">
            重置
          </Link>
        </div>
      </form>

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
                <th className="text-left px-4 py-3 font-medium text-gray-600">角色</th>
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
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                      ROLE_BADGE_CLASSES[op.role] ?? 'bg-gray-100 text-gray-500'
                    }`}>
                      {ROLE_LABELS[op.role] ?? op.role}
                    </span>
                  </td>
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
