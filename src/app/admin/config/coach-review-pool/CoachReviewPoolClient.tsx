'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { updateCoachReviewPoolConfig } from '@/app/actions/coachReviewConfigActions'
import type { PoolOperator } from '@/app/actions/coachReviewConfigActions'

export default function CoachReviewPoolClient({
  operators
}: {
  operators: PoolOperator[]
}) {
  const router = useRouter()
  const [weights, setWeights] = useState<Record<string, number>>(() => {
    const map: Record<string, number> = {}
    for (const op of operators) {
      map[op.id] = op.weight
    }
    return map
  })
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const enabledOps = useMemo(() => operators.filter((o) => o.isEnabled), [operators])
  const disabledOps = useMemo(() => operators.filter((o) => !o.isEnabled), [operators])

  const activeCount = useMemo(
    () => enabledOps.filter((o) => (weights[o.id] ?? 1) > 0).length,
    [enabledOps, weights]
  )

  const totalWeight = useMemo(
    () =>
      enabledOps.reduce(
        (sum, o) => {
          const w = weights[o.id] ?? 1
          return sum + (w > 0 ? w : 0)
        },
        0
      ),
    [enabledOps, weights]
  )

  const handleSave = async () => {
    if (activeCount === 0 && enabledOps.length > 0) {
      setMessage({
        type: 'error',
        text: '所有启用运营的权重均为 0，保存后配置将被忽略，系统将退化为全部启用运营等权分配。请至少保留一个权重 > 0 的运营。'
      })
      return
    }

    setLoading(true)
    setMessage(null)

    const payload = operators.map((op) => ({
      operatorId: op.id,
      weight: weights[op.id] ?? 1
    }))

    const result = await updateCoachReviewPoolConfig(payload)

    setLoading(false)

    if (result.success) {
      setMessage({ type: 'success', text: '保存成功！' })
      router.refresh()
    } else {
      setMessage({ type: 'error', text: result.error || '保存失败' })
    }
  }

  const handleResetAll = () => {
    const reset: Record<string, number> = {}
    for (const op of operators) {
      reset[op.id] = 1
    }
    setWeights(reset)
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">🎲 教练初审随机分配池</h1>
        <p className="text-gray-600 mt-1">
          当教练的邀请人链路无法解析出初审运营时（外部接口失败 / 无上级学管 / 无团队认领人），从此池按权重随机分配一个运营负责初审。
        </p>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
        <h3 className="text-sm font-semibold text-blue-900 mb-2">分配规则说明</h3>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>• 默认所有启用运营均纳入分配池，权重为 1（等概率分配）</li>
          <li>• 权重 &gt; 0 的运营按比例随机分配（如 A=5, B=3 → A 获得 5/8 概率，B 获得 3/8）</li>
          <li>• 权重设为 <strong>0</strong> 表示将该运营<strong>排除出随机分配</strong></li>
          <li>• 已禁用的运营无法参与分配（无论权重设置）</li>
          <li>• 分配结果以教练 ID 为种子确定性选取，同一教练重跑结果不变</li>
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

        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-4 text-sm text-gray-600">
            <span>启用运营：{enabledOps.length} 人</span>
            <span>参与分配：{activeCount} 人</span>
            <span>总权重：{totalWeight}</span>
          </div>
          <button
            onClick={handleResetAll}
            className="text-sm text-gray-500 hover:text-gray-700 underline"
          >
            全部重置为 1
          </button>
        </div>

        {enabledOps.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            暂无启用的运营人员
          </div>
        ) : (
          <div className="space-y-3">
            {enabledOps.map((op) => {
              const w = weights[op.id] ?? 1
              const percent = totalWeight > 0 ? ((w > 0 ? w : 0) / totalWeight) * 100 : 0
              return (
                <div
                  key={op.id}
                  className={`flex items-center gap-4 p-3 rounded-lg border ${
                    w > 0
                      ? 'border-gray-200 bg-white'
                      : 'border-gray-200 bg-gray-50'
                  }`}
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-900">{op.name}</span>
                      <span className="text-sm text-gray-500">{op.phone}</span>
                      {w === 0 && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-gray-200 text-gray-600">
                          已关闭
                        </span>
                      )}
                    </div>
                    {w > 0 && totalWeight > 0 && (
                      <div className="mt-1 flex items-center gap-2">
                        <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden max-w-xs">
                          <div
                            className="h-full bg-primary-500 rounded-full transition-all"
                            style={{ width: `${percent}%` }}
                          />
                        </div>
                        <span className="text-xs text-gray-500">
                          {percent.toFixed(1)}%
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <label className="text-sm text-gray-500">权重</label>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={w}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value)
                        setWeights((prev) => ({
                          ...prev,
                          [op.id]: isNaN(val) ? 0 : Math.max(0, val)
                        }))
                      }}
                      className="w-20 px-3 py-1.5 border border-gray-300 rounded-lg text-center focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    />
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {disabledOps.length > 0 && (
          <div className="mt-6">
            <h3 className="text-sm font-medium text-gray-500 mb-2">
              已禁用运营（不参与分配）
            </h3>
            <div className="space-y-2">
              {disabledOps.map((op) => (
                <div
                  key={op.id}
                  className="flex items-center gap-2 p-2 text-sm text-gray-400"
                >
                  <span className="line-through">{op.name}</span>
                  <span>{op.phone}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="mt-6 pt-4 border-t border-gray-200">
          <button
            onClick={handleSave}
            disabled={loading}
            className="w-full bg-primary-600 text-white py-3 px-6 rounded-lg hover:bg-primary-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? '保存中...' : '保存配置'}
          </button>
        </div>
      </div>
    </div>
  )
}
