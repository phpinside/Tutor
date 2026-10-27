import { SENSITIVE_FIELD_LABELS } from '@/lib/teacherSensitiveFields'
import type { SensitiveField } from '@/lib/teacherSensitiveFields'
import {
  INFO_CHANGE_STATUS_LABELS,
  INFO_CHANGE_STATUS_BADGE,
} from '@/lib/teacherInfoChangeShared'
import type { InfoChangeReviewItemView } from '@/lib/teacherInfoChangeShared'

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

/** 教练详情页：该教练的资料修改申请历史（只读） */
export default function TeacherInfoChangeRequestHistory({
  items,
}: {
  items: InfoChangeReviewItemView[]
}) {
  return (
    <div className="card mb-8">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-900">资料修改申请</h2>
        <a
          href="/admin/teachers/info-change-requests"
          className="text-sm text-primary-600 hover:underline underline-offset-2"
        >
          前往审核工作台
        </a>
      </div>
      {items.length === 0 ? (
        <p className="text-sm text-gray-400">暂无申请记录</p>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <div key={item.id} className="rounded-lg border border-gray-200 p-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`badge text-xs ${INFO_CHANGE_STATUS_BADGE[item.status]}`}>
                    {INFO_CHANGE_STATUS_LABELS[item.status]}
                  </span>
                  <span className="text-xs text-gray-400">提交于 {formatTime(item.createdAt)}</span>
                  {item.appliedAt && (
                    <span className="text-xs text-gray-400">生效于 {formatTime(item.appliedAt)}</span>
                  )}
                </div>
                <a
                  href={`/admin/teachers/info-change-requests`}
                  className="text-xs text-gray-400 hover:text-primary-600"
                >
                  申请单 {item.id.slice(-8)}
                </a>
              </div>
              <div className="mt-2 space-y-1">
                {Object.entries(item.changes).map(([field, change]) => (
                  <p key={field} className="text-sm text-gray-700">
                    <span className="text-gray-500">
                      {SENSITIVE_FIELD_LABELS[field as SensitiveField] ?? field}：
                    </span>
                    {formatValue(change.from)} → <span className="font-medium">{formatValue(change.to)}</span>
                  </p>
                ))}
              </div>
              {(item.firstReviewerName || item.finalReviewerName) && (
                <div className="mt-2 text-xs text-gray-500 space-y-0.5">
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
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
