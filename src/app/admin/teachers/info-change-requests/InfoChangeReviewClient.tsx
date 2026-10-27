'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { SENSITIVE_FIELD_LABELS } from '@/lib/teacherSensitiveFields'
import type { SensitiveField } from '@/lib/teacherSensitiveFields'
import {
  INFO_CHANGE_STATUS_LABELS,
  INFO_CHANGE_STATUS_BADGE,
} from '@/lib/teacherInfoChangeShared'
import type { InfoChangeReviewItemView } from '@/lib/teacherInfoChangeShared'
import {
  firstReviewInfoChangeRequest,
  finalReviewInfoChangeRequest,
} from '@/app/actions/teacherInfoChangeRequest'

type ViewerKind = 'ADMIN' | 'OPERATOR' | 'LEARNER_MANAGER'

type TabKey = 'first' | 'final' | 'done' | 'all'

const FIELD_ORDER: SensitiveField[] = [
  'name',
  'gaokaoProvince',
  'mathScore',
  'physicsScore',
  'chemistryScore',
]

function formatValue(value: unknown): string {
  if (value === null || value === undefined || value === '') return '（空）'
  return String(value)
}

function formatTime(iso: string | null): string {
  if (!iso) return '-'
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export default function InfoChangeReviewClient({
  viewerKind,
  items,
}: {
  viewerKind: ViewerKind
  items: InfoChangeReviewItemView[]
}) {
  const router = useRouter()
  const [tab, setTab] = useState<TabKey>(viewerKind === 'OPERATOR' ? 'final' : 'first')
  const [search, setSearch] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)
  const [rejectTarget, setRejectTarget] = useState<{ id: string; stage: 'first' | 'final' } | null>(null)
  const [rejectNote, setRejectNote] = useState('')
  const [actionError, setActionError] = useState('')

  const canFinalReview = viewerKind === 'OPERATOR' || viewerKind === 'ADMIN'

  const filtered = useMemo(() => {
    const keyword = search.trim().toLowerCase()
    return items.filter((item) => {
      const statusMatch =
        tab === 'all' ||
        (tab === 'first' && item.status === 'PENDING_FIRST_REVIEW') ||
        (tab === 'final' && item.status === 'PENDING_FINAL_REVIEW') ||
        (tab === 'done' && ['APPROVED', 'REJECTED', 'CANCELLED'].includes(item.status))
      if (!statusMatch) return false
      if (!keyword) return true
      return (
        item.teacher.name?.toLowerCase().includes(keyword) ||
        item.teacher.phone?.includes(keyword)
      )
    })
  }, [items, tab, search])

  const countByTab = useMemo(() => {
    const counts: Record<TabKey, number> = { first: 0, final: 0, done: 0, all: items.length }
    for (const item of items) {
      if (item.status === 'PENDING_FIRST_REVIEW') counts.first += 1
      else if (item.status === 'PENDING_FINAL_REVIEW') counts.final += 1
      else counts.done += 1
    }
    return counts
  }, [items])

  const refresh = () => router.refresh()

  const handleFirstReview = async (id: string, decision: 'APPROVED' | 'REJECTED', note?: string) => {
    setBusyId(id)
    setActionError('')
    try {
      const result = await firstReviewInfoChangeRequest(id, decision, note)
      if (!result.success) {
        setActionError(result.error || '操作失败')
        return
      }
      setRejectTarget(null)
      setRejectNote('')
      refresh()
    } finally {
      setBusyId(null)
    }
  }

  const handleFinalReview = async (id: string, decision: 'APPROVED' | 'REJECTED', note?: string) => {
    setBusyId(id)
    setActionError('')
    try {
      const result = await finalReviewInfoChangeRequest(id, decision, note)
      if (!result.success) {
        setActionError(result.error || '操作失败')
        return
      }
      setRejectTarget(null)
      setRejectNote('')
      refresh()
    } finally {
      setBusyId(null)
    }
  }

  const handleApprove = (
    item: InfoChangeReviewItemView,
    stage: 'first' | 'final'
  ) => {
    const tip =
      stage === 'final'
        ? `确认通过并生效？\n将把申请内容写入该教练的资料：\n${Object.entries(item.changes)
            .map(([field, change]) => `${SENSITIVE_FIELD_LABELS[field as SensitiveField] ?? field}：${formatValue(change.from)} → ${formatValue(change.to)}`)
            .join('\n')}`
        : '确认初审通过？通过后将进入运营复审。'
    if (!confirm(tip)) return
    if (stage === 'first') handleFirstReview(item.id, 'APPROVED')
    else handleFinalReview(item.id, 'APPROVED')
  }

  const handleReject = async () => {
    if (!rejectTarget) return
    if (!rejectNote.trim()) {
      setActionError('驳回时必须填写原因')
      return
    }
    if (rejectTarget.stage === 'first') {
      await handleFirstReview(rejectTarget.id, 'REJECTED', rejectNote.trim())
    } else {
      await handleFinalReview(rejectTarget.id, 'REJECTED', rejectNote.trim())
    }
  }

  const tabs: { key: TabKey; label: string }[] = [
    { key: 'first', label: `待初审（${countByTab.first}）` },
    { key: 'final', label: `待复审（${countByTab.final}）` },
    { key: 'done', label: `已处理（${countByTab.done}）` },
    { key: 'all', label: `全部（${countByTab.all}）` },
  ]

  return (
    <div>
      {/* 筛选栏 */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-4">
        <div className="flex flex-wrap gap-2">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                tab === t.key
                  ? 'bg-primary-600 text-white'
                  : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="搜索教练姓名 / 手机号"
          className="sm:ml-auto w-full sm:w-64 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-primary-400 focus:outline-none"
        />
      </div>

      {actionError && (
        <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-2 text-sm text-red-700">
          {actionError}
        </div>
      )}

      {/* 列表 */}
      {filtered.length === 0 ? (
        <div className="card text-center text-gray-400 py-12">暂无申请记录</div>
      ) : (
        <div className="space-y-4">
          {filtered.map((item) => {
            const isPendingFirst = item.status === 'PENDING_FIRST_REVIEW'
            const isPendingFinal = item.status === 'PENDING_FINAL_REVIEW'
            const showFirstActions = isPendingFirst
            const showFinalActions = isPendingFinal && canFinalReview

            return (
              <div key={item.id} className="card">
                {/* 头部：教练信息 + 状态 */}
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between mb-4">
                  <div>
                    <a
                      href={`/admin/teachers/${item.teacher.id}`}
                      className="font-semibold text-gray-900 hover:text-primary-600"
                    >
                      {item.teacher.name || '未命名教练'}
                    </a>
                    <span className="ml-2 text-sm text-gray-500">{item.teacher.phone}</span>
                    <span className="ml-2 text-xs text-gray-400">提交于 {formatTime(item.createdAt)}</span>
                  </div>
                  <span className={`badge text-xs self-start sm:self-auto ${INFO_CHANGE_STATUS_BADGE[item.status]}`}>
                    {INFO_CHANGE_STATUS_LABELS[item.status]}
                  </span>
                </div>

                {/* 字段变更 */}
                <div className="rounded-lg border border-gray-200 divide-y divide-gray-100 mb-3">
                  {Object.entries(item.changes).map(([field, change]) => {
                    const key = field as SensitiveField
                    const current = item.teacherCurrent[key]
                    const fromStr = change.from === null || change.from === undefined ? '' : String(change.from)
                    const toStr = change.to === null || change.to === undefined ? '' : String(change.to)
                    const drifted = current !== fromStr && current !== toStr
                    return (
                      <div key={field} className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 px-3 py-2">
                        <span className="text-sm text-gray-500 sm:w-32 shrink-0">
                          {SENSITIVE_FIELD_LABELS[key] ?? field}
                        </span>
                        <span className="text-sm">
                          <span className="text-gray-500">{formatValue(change.from)}</span>
                          <span className="mx-2 text-gray-400">→</span>
                          <span className="font-semibold text-gray-900">{formatValue(change.to)}</span>
                        </span>
                        {drifted && (
                          <span className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded px-2 py-0.5 sm:ml-auto">
                            注意：当前实际值已为「{formatValue(current)}」，与提交时不一致
                          </span>
                        )}
                      </div>
                    )
                  })}
                </div>

                {item.reason && (
                  <p className="text-sm text-gray-600 mb-2">
                    <span className="text-gray-400">修改说明：</span>
                    {item.reason}
                  </p>
                )}

                {/* 证明截图 */}
                <div className="mb-3">
                  <p className="text-xs text-gray-400 mb-2">高考成绩查询截图（证明材料）</p>
                  <div className="flex flex-wrap gap-2">
                    {item.proofImages.map((key) => (
                      <a key={key} href={item.proofUrls[key]} target="_blank" rel="noopener noreferrer">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={item.proofUrls[key]}
                          alt="证明材料"
                          className="w-24 h-24 object-cover rounded-lg border border-gray-200 hover:opacity-90"
                        />
                      </a>
                    ))}
                  </div>
                </div>

                {/* 审核链 */}
                {(item.firstReviewerName || item.finalReviewerName) && (
                  <div className="text-xs text-gray-500 space-y-1 mb-3">
                    {item.firstReviewerName && (
                      <p>
                        初审：{item.firstReviewerName} · {formatTime(item.firstReviewedAt)}
                        {item.firstReviewNote && ` · ${item.firstReviewNote}`}
                      </p>
                    )}
                    {item.finalReviewerName && (
                      <p>
                        复审：{item.finalReviewerName} · {formatTime(item.finalReviewedAt)}
                        {item.finalReviewNote && ` · ${item.finalReviewNote}`}
                      </p>
                    )}
                    {item.appliedAt && <p>生效时间：{formatTime(item.appliedAt)}</p>}
                  </div>
                )}

                {/* 审核操作 */}
                {(showFirstActions || showFinalActions) && (
                  <div className="border-t border-gray-100 pt-3">
                    {isPendingFirst && (
                      <p className="text-xs text-gray-400 mb-2">
                        {viewerKind === 'LEARNER_MANAGER'
                          ? '学管初审：通过后转交运营复审'
                          : viewerKind === 'OPERATOR'
                            ? '运营兜底初审：通过后转交运营复审（建议由其他运营复审）'
                            : '超管越级初审：通过后转交运营复审'}
                      </p>
                    )}
                    {isPendingFinal && (
                      <p className="text-xs text-gray-400 mb-2">
                        运营复审：通过后立即写入教练资料并生效
                      </p>
                    )}
                    <div className="flex flex-wrap items-center gap-2">
                      {showFirstActions && (
                        <>
                          <button
                            onClick={() => handleApprove(item, 'first')}
                            disabled={busyId === item.id}
                            className="px-4 py-2 rounded-lg bg-green-600 hover:bg-green-700 text-white text-sm font-medium disabled:opacity-50"
                          >
                            初审通过
                          </button>
                          <button
                            onClick={() => {
                              setRejectTarget(rejectTarget?.id === item.id ? null : { id: item.id, stage: 'first' })
                              setRejectNote('')
                              setActionError('')
                            }}
                            disabled={busyId === item.id}
                            className="px-4 py-2 rounded-lg border border-red-300 text-red-600 text-sm hover:bg-red-50 disabled:opacity-50"
                          >
                            驳回
                          </button>
                        </>
                      )}
                      {showFinalActions && (
                        <>
                          <button
                            onClick={() => handleApprove(item, 'final')}
                            disabled={busyId === item.id}
                            className="px-4 py-2 rounded-lg bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium disabled:opacity-50"
                          >
                            通过并生效
                          </button>
                          <button
                            onClick={() => {
                              setRejectTarget(rejectTarget?.id === item.id ? null : { id: item.id, stage: 'final' })
                              setRejectNote('')
                              setActionError('')
                            }}
                            disabled={busyId === item.id}
                            className="px-4 py-2 rounded-lg border border-red-300 text-red-600 text-sm hover:bg-red-50 disabled:opacity-50"
                          >
                            驳回
                          </button>
                        </>
                      )}
                    </div>

                    {/* 驳回原因输入 */}
                    {rejectTarget?.id === item.id && (
                      <div className="mt-3 rounded-lg bg-gray-50 border border-gray-200 p-3">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          驳回原因（必填，教练可见）
                        </label>
                        <textarea
                          value={rejectNote}
                          onChange={(e) => setRejectNote(e.target.value)}
                          rows={2}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-primary-400 focus:outline-none resize-none"
                          placeholder="例如：截图不清晰 / 成绩与截图不符，请重新提交"
                        />
                        <div className="flex justify-end gap-2 mt-2">
                          <button
                            onClick={() => setRejectTarget(null)}
                            className="px-3 py-1.5 rounded-lg border border-gray-300 text-gray-600 text-sm hover:bg-gray-100"
                          >
                            取消
                          </button>
                          <button
                            onClick={handleReject}
                            disabled={busyId === item.id}
                            className="px-4 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm disabled:opacity-50"
                          >
                            {busyId === item.id ? '处理中…' : '确认驳回'}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
