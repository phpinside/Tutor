'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { updateScopeSettings } from '@/app/actions/learnerManagerScopeActions'

type OperatorOption = { id: string; name: string; phone: string; isEnabled: boolean }

export default function LearnerManagerScopeCard({
  initialEnabledIds,
  operators,
}: {
  initialEnabledIds: string[]
  operators: OperatorOption[]
}) {
  const router = useRouter()
  const [enabledIds, setEnabledIds] = useState<string[]>(initialEnabledIds)
  const [message, setMessage] = useState('')
  const [pending, startTransition] = useTransition()

  const allEnabled = enabledIds.includes('*')
  const disabled = enabledIds.length === 0

  const statusText = allEnabled
    ? '已全量启用（所有学管按白名单可见）'
    : disabled
      ? '已关闭（当前行为与改造前一致）'
      : `灰度中：已启用 ${enabledIds.length} 名学管`

  const statusClass = allEnabled
    ? 'badge-success'
    : disabled
      ? 'badge-gray'
      : 'badge-warning'

  const save = async (next: string[]) => {
    setMessage('')
    const result = await updateScopeSettings(next)
    if (result.success) {
      setEnabledIds(next)
      setMessage('✅ 已保存，下一请求生效')
      startTransition(() => router.refresh())
    } else {
      setMessage(`❌ ${result.error ?? '保存失败'}`)
    }
  }

  const toggleOperator = (id: string) => {
    if (pending) return
    if (allEnabled) {
      // 从全量切到灰度：除当前点击者外全部启用
      void save(operators.filter((op) => op.id !== id).map((op) => op.id))
      return
    }
    const next = enabledIds.includes(id)
      ? enabledIds.filter((v) => v !== id)
      : [...enabledIds, id]
    void save(next)
  }

  return (
    <div className="card p-5">
      <div className="flex items-center gap-4 mb-4">
        <span className="text-3xl">🛡️</span>
        <div className="flex-1">
          <h3 className="font-semibold text-gray-900">学管数据范围（灰度开关）</h3>
          <p className="text-sm text-gray-600 mt-1">
            启用后，学管在老师管理中只能看到：已归属其名下的、分配给其初审的、其本人邀请的老师；认领搜索仅显示无归属老师；重置密码仅限范围内老师。关闭则保持改造前行为。
          </p>
        </div>
        <span className={`badge ${statusClass} whitespace-nowrap`}>{statusText}</span>
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-3">
        <button
          onClick={() => save(['*'])}
          disabled={pending || allEnabled}
          className="btn-outline text-sm px-3 py-1.5 disabled:opacity-50"
        >
          全量启用
        </button>
        <button
          onClick={() => save([])}
          disabled={pending || disabled}
          className="btn-outline text-sm px-3 py-1.5 disabled:opacity-50"
        >
          全部关闭（回滚）
        </button>
        <span className="text-xs text-gray-400">变更即时生效（下一请求），无需重新部署</span>
      </div>

      <div className="flex flex-wrap gap-2">
        {operators.length === 0 && (
          <p className="text-sm text-gray-400">暂无学管账号</p>
        )}
        {operators.map((op) => {
          const on = allEnabled || enabledIds.includes(op.id)
          return (
            <button
              key={op.id}
              onClick={() => toggleOperator(op.id)}
              disabled={pending || !op.isEnabled}
              title={op.isEnabled ? '' : '该账号已禁用'}
              className={`text-sm px-3 py-1.5 rounded-lg border transition-colors ${
                on
                  ? 'bg-primary-50 border-primary-300 text-primary-700'
                  : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300'
              } ${!op.isEnabled ? 'opacity-40 cursor-not-allowed' : ''}`}
            >
              {op.name}
              <span className="ml-1 text-xs text-gray-400">{op.phone.slice(-4)}</span>
              <span className="ml-1">{on ? '✓' : ''}</span>
            </button>
          )
        })}
      </div>

      {message && (
        <p className={`mt-3 text-sm ${message.startsWith('✅') ? 'text-green-600' : 'text-red-600'}`}>
          {message}
        </p>
      )}
    </div>
  )
}
