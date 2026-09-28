'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { PoolOperator } from '@/app/actions/coachReviewConfigActions'

type SaveAction = (
  weights: { operatorId: string; weight: number }[]
) => Promise<{ success: boolean; error?: string }>

const ROLE_LABELS: Record<string, string> = {
  LEARNER_MANAGER: '学管',
  OPERATOR: '运营',
}

const ROLE_BADGES: Record<string, string> = {
  LEARNER_MANAGER: 'bg-blue-100 text-blue-700',
  OPERATOR: 'bg-amber-100 text-amber-700',
}

/**
 * 加权随机分配池管理（业界通行交互）：
 * - 参与开关：默认全员等权参与；关闭即排除（权重 0），重新打开恢复原权重或 1
 * - 搜索：人数多时快速定位
 * - 批量操作：全部参与 / 全部排除 / 恢复等权
 * - 权重微调：参与行内弱化展示（进阶用法），比例条实时预览
 */
export default function WeightedPoolManager({
  icon,
  title,
  description,
  rules,
  operators,
  saveAction,
}: {
  icon: string
  title: string
  description: string
  rules: string[]
  operators: PoolOperator[]
  saveAction: SaveAction
}) {
  const router = useRouter()
  const [weights, setWeights] = useState<Record<string, number>>(() => {
    const map: Record<string, number> = {}
    for (const op of operators) map[op.id] = op.weight
    return map
  })
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const enabledOps = useMemo(() => operators.filter((o) => o.isEnabled), [operators])
  const visibleOps = useMemo(() => {
    const kw = search.trim().toLowerCase()
    if (!kw) return enabledOps
    return enabledOps.filter(
      (o) => o.name.toLowerCase().includes(kw) || o.phone.includes(kw)
    )
  }, [enabledOps, search])

  const participants = useMemo(
    () => enabledOps.filter((o) => (weights[o.id] ?? 1) > 0),
    [enabledOps, weights]
  )
  const totalWeight = useMemo(
    () => participants.reduce((sum, o) => sum + (weights[o.id] ?? 1), 0),
    [participants, weights]
  )

  const setWeight = (id: string, value: number) =>
    setWeights((prev) => ({ ...prev, [id]: Math.max(0, value) }))

  const toggleParticipate = (op: PoolOperator) => {
    const current = weights[op.id] ?? 1
    if (current > 0) {
      setWeight(op.id, 0) // 排除（记住原权重以便恢复）
    } else {
      setWeight(op.id, 1) // 恢复参与（等权）
    }
  }

  const bulkSet = (value: number) => {
    const next: Record<string, number> = {}
    for (const op of enabledOps) next[op.id] = value
    setWeights(next)
  }

  const handleSave = async () => {
    if (participants.length === 0 && enabledOps.length > 0) {
      setMessage({
        type: 'error',
        text: '当前没有任何参与分配的人员，保存后配置将被忽略，系统将退化为全部启用人员等权分配。请至少让一人参与。',
      })
      return
    }
    setLoading(true)
    setMessage(null)
    const payload = operators.map((op) => ({ operatorId: op.id, weight: weights[op.id] ?? 1 }))
    const result = await saveAction(payload)
    setLoading(false)
    if (result.success) {
      setMessage({ type: 'success', text: '保存成功！' })
      router.refresh()
    } else {
      setMessage({ type: 'error', text: result.error || '保存失败' })
    }
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">
          {icon} {title}
        </h1>
        <p className="text-gray-600 mt-1">{description}</p>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
        <h3 className="text-sm font-semibold text-blue-900 mb-2">分配规则</h3>
        <ul className="text-sm text-blue-800 space-y-1">
          {rules.map((rule, i) => (
            <li key={i}>• {rule}</li>
          ))}
        </ul>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        {message && (
          <div
            className={`mb-4 p-4 rounded-lg ${
              message.type === 'success'
                ? 'bg-green-50 border border-green-200 text-green-800'
                : 'bg-red-50 border border-red-200 text-red-800'
            }`}
          >
            {message.text}
          </div>
        )}

        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="搜索姓名 / 手机号…"
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm w-full md:w-64"
          />
          <div className="flex flex-wrap items-center gap-3 text-sm text-gray-600">
            <span>参与：{participants.length} 人</span>
            <span>总权重：{totalWeight}</span>
            <button
              onClick={() => bulkSet(1)}
              className="text-sm text-gray-500 hover:text-gray-700 underline"
            >
              全部等权参与
            </button>
            <button
              onClick={() => bulkSet(0)}
              className="text-sm text-gray-500 hover:text-gray-700 underline"
            >
              全部排除
            </button>
          </div>
        </div>

        {visibleOps.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            {search ? '未找到匹配人员' : '暂无参与分配的人员'}
          </div>
        ) : (
          <div className="space-y-3">
            {visibleOps.map((op) => {
              const w = weights[op.id] ?? 1
              const participating = w > 0
              const percent = totalWeight > 0 && participating ? (w / totalWeight) * 100 : 0
              return (
                <div
                  key={op.id}
                  className={`flex items-center gap-4 p-3 rounded-lg border ${
                    participating ? 'border-gray-200 bg-white' : 'border-gray-200 bg-gray-50'
                  }`}
                >
                  {/* 参与开关 */}
                  <button
                    type="button"
                    onClick={() => toggleParticipate(op)}
                    className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus:outline-none ${
                      participating ? 'bg-green-500' : 'bg-gray-300'
                    }`}
                    aria-label={participating ? '点击排除' : '点击参与'}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                        participating ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-gray-900">{op.name}</span>
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full ${
                          ROLE_BADGES[op.role] ?? 'bg-gray-100 text-gray-500'
                        }`}
                      >
                        {ROLE_LABELS[op.role] ?? op.role}
                      </span>
                      <span className="text-sm text-gray-500">{op.phone}</span>
                      {!op.isEnabled && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-gray-200 text-gray-600">
                          已禁用
                        </span>
                      )}
                      {participating && w !== 1 && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-orange-100 text-orange-700">
                          自定义权重
                        </span>
                      )}
                      {!participating && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-gray-200 text-gray-600">
                          已排除
                        </span>
                      )}
                    </div>
                    {participating && totalWeight > 0 && (
                      <div className="mt-1 flex items-center gap-2">
                        <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden max-w-xs">
                          <div
                            className="h-full bg-primary-500 rounded-full transition-all"
                            style={{ width: `${percent}%` }}
                          />
                        </div>
                        <span className="text-xs text-gray-500">{percent.toFixed(1)}%</span>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <label className="text-xs text-gray-400">权重</label>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={w}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value)
                        setWeight(op.id, isNaN(val) ? 0 : val)
                      }}
                      disabled={!participating}
                      className={`w-20 px-3 py-1.5 border border-gray-300 rounded-lg text-center focus:ring-2 focus:ring-primary-500 focus:border-transparent ${
                        participating ? '' : 'bg-gray-100 text-gray-400'
                      }`}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        )}

        <div className="mt-6">
          <button onClick={handleSave} disabled={loading} className="btn-primary w-full">
            {loading ? '保存中…' : '保存分配比例'}
          </button>
        </div>
      </div>
    </div>
  )
}
