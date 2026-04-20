'use client'

import { useState, useEffect, useRef, useCallback } from 'react'

interface CheckRecord {
  id: string
  fileName: string
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED'
  result: string | null
  errorMsg: string | null
  createdAt: string
}

interface AnalysisIssue {
  dimension: string
  severity: 'high' | 'medium' | 'low'
  description: string
  quote?: string
}

interface AnalysisSuggestion {
  dimension: string
  priority: 'high' | 'medium' | 'low'
  content: string
  example?: string
}

interface AnalysisResult {
  summary: string
  score: number
  issues: AnalysisIssue[]
  suggestions: AnalysisSuggestion[]
}

interface Props {
  teacherId: string
  initialRecords: CheckRecord[]
}

const STATUS_LABELS: Record<string, { text: string; color: string }> = {
  PENDING: { text: '等待处理', color: 'text-amber-600 bg-amber-50 border-amber-200' },
  PROCESSING: { text: '分析中...', color: 'text-blue-600 bg-blue-50 border-blue-200' },
  COMPLETED: { text: '已完成', color: 'text-green-600 bg-green-50 border-green-200' },
  FAILED: { text: '分析失败', color: 'text-red-600 bg-red-50 border-red-200' },
}

const SEVERITY_CONFIG = {
  high: { label: '严重', color: 'text-red-700 bg-red-50 border-red-200' },
  medium: { label: '一般', color: 'text-amber-700 bg-amber-50 border-amber-200' },
  low: { label: '轻微', color: 'text-blue-700 bg-blue-50 border-blue-200' },
}

const PRIORITY_CONFIG = {
  high: { label: '优先', color: 'text-red-700 bg-red-50 border-red-200' },
  medium: { label: '次要', color: 'text-amber-700 bg-amber-50 border-amber-200' },
  low: { label: '可选', color: 'text-gray-600 bg-gray-50 border-gray-200' },
}

function ScoreCircle({ score }: { score: number }) {
  const color = score >= 80 ? '#22c55e' : score >= 60 ? '#f59e0b' : '#ef4444'
  return (
    <div className="flex flex-col items-center">
      <div
        className="w-20 h-20 rounded-full flex items-center justify-center border-4 font-bold text-2xl"
        style={{ borderColor: color, color }}
      >
        {score}
      </div>
      <span className="text-xs text-gray-500 mt-1">综合评分</span>
    </div>
  )
}

function AnalysisDisplay({ result }: { result: string }) {
  let parsed: AnalysisResult | null = null
  try {
    parsed = JSON.parse(result)
  } catch {
    return (
      <div className="mt-4 p-4 bg-gray-50 rounded-lg text-sm text-gray-700 whitespace-pre-wrap">
        {result}
      </div>
    )
  }

  if (!parsed) return null

  return (
    <div className="mt-4 space-y-6">
      {/* Summary & Score */}
      <div className="flex items-start gap-6 p-4 bg-indigo-50 rounded-xl border border-indigo-100">
        <ScoreCircle score={parsed.score} />
        <div className="flex-1">
          <h4 className="text-sm font-semibold text-indigo-900 mb-1">总体评价</h4>
          <p className="text-sm text-indigo-800 leading-relaxed">{parsed.summary}</p>
        </div>
      </div>

      {/* Issues */}
      {parsed.issues.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <span className="text-base">⚠️</span>
            发现的问题 ({parsed.issues.length})
          </h4>
          <div className="space-y-3">
            {parsed.issues.map((issue, i) => {
              const cfg = SEVERITY_CONFIG[issue.severity]
              return (
                <div key={i} className="p-4 bg-white rounded-lg border border-gray-200 shadow-sm">
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${cfg.color}`}>
                      {cfg.label}
                    </span>
                    <span className="text-xs font-medium text-gray-600 bg-gray-100 px-2 py-0.5 rounded-full">
                      {issue.dimension}
                    </span>
                  </div>
                  <p className="text-sm text-gray-800">{issue.description}</p>
                  {issue.quote && (
                    <blockquote className="mt-2 pl-3 border-l-2 border-gray-300 text-xs text-gray-500 italic">
                      {issue.quote}
                    </blockquote>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Suggestions */}
      {parsed.suggestions.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <span className="text-base">💡</span>
            改进建议 ({parsed.suggestions.length})
          </h4>
          <div className="space-y-3">
            {parsed.suggestions.map((s, i) => {
              const cfg = PRIORITY_CONFIG[s.priority]
              return (
                <div key={i} className="p-4 bg-white rounded-lg border border-gray-200 shadow-sm">
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${cfg.color}`}>
                      {cfg.label}
                    </span>
                    <span className="text-xs font-medium text-gray-600 bg-gray-100 px-2 py-0.5 rounded-full">
                      {s.dimension}
                    </span>
                  </div>
                  <p className="text-sm text-gray-800">{s.content}</p>
                  {s.example && (
                    <div className="mt-2 p-2 bg-green-50 rounded text-xs text-green-800 border border-green-100">
                      <span className="font-medium">示例：</span>{s.example}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

function RecordCard({
  record,
  onStatusUpdate,
}: {
  record: CheckRecord
  onStatusUpdate: (id: string, updated: Partial<CheckRecord>) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const isActive = record.status === 'PENDING' || record.status === 'PROCESSING'
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (!isActive) return

    const poll = async () => {
      try {
        const res = await fetch(`/api/tools/planner-checker/${record.id}`)
        if (!res.ok) return
        const data = await res.json()
        if (data.status !== record.status) {
          onStatusUpdate(record.id, {
            status: data.status,
            result: data.result,
            errorMsg: data.errorMsg,
          })
        }
        if (data.status === 'COMPLETED' || data.status === 'FAILED') {
          if (intervalRef.current) clearInterval(intervalRef.current)
        }
      } catch {
        // ignore polling errors
      }
    }

    intervalRef.current = setInterval(poll, 3000)
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [record.id, record.status, isActive, onStatusUpdate])

  const statusCfg = STATUS_LABELS[record.status]
  const date = new Date(record.createdAt).toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })

  return (
    <div className="border border-gray-200 rounded-xl bg-white shadow-sm overflow-hidden">
      <div
        className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-gray-50 transition-colors"
        onClick={() => record.status === 'COMPLETED' && setExpanded(e => !e)}
      >
        <div className="flex items-center gap-3 min-w-0">
          <span className="text-xl flex-shrink-0">📄</span>
          <div className="min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate">{record.fileName}</p>
            <p className="text-xs text-gray-500">{date}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className={`text-xs font-medium px-2 py-1 rounded-full border ${statusCfg.color}`}>
            {statusCfg.text}
          </span>
          {record.status === 'COMPLETED' && (
            <span className="text-gray-400 text-sm">{expanded ? '▲' : '▼'}</span>
          )}
        </div>
      </div>

      {record.status === 'PROCESSING' && (
        <div className="px-4 pb-3">
          <div className="h-1.5 bg-blue-100 rounded-full overflow-hidden">
            <div className="h-full bg-blue-400 rounded-full animate-pulse w-2/3" />
          </div>
        </div>
      )}

      {record.status === 'FAILED' && record.errorMsg && (
        <div className="px-4 pb-3">
          <p className="text-xs text-red-600">{record.errorMsg}</p>
        </div>
      )}

      {record.status === 'COMPLETED' && expanded && record.result && (
        <div className="px-4 pb-4 border-t border-gray-100">
          <AnalysisDisplay result={record.result} />
        </div>
      )}
    </div>
  )
}

export default function PlannerCheckerClient({ teacherId, initialRecords }: Props) {
  const [records, setRecords] = useState<CheckRecord[]>(initialRecords)
  const [file, setFile] = useState<File | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleStatusUpdate = useCallback((id: string, updated: Partial<CheckRecord>) => {
    setRecords(prev => prev.map(r => r.id === id ? { ...r, ...updated } : r))
  }, [])

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return
    if (f.type !== 'application/pdf') {
      setError('请上传 PDF 格式的规划书')
      return
    }
    if (f.size > 20 * 1024 * 1024) {
      setError('文件大小不能超过 20MB')
      return
    }
    setError(null)
    setFile(f)
  }

  const handleSubmit = async () => {
    if (!file) return
    setSubmitting(true)
    setError(null)

    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('teacherId', teacherId)

      const res = await fetch('/api/tools/planner-checker/submit', {
        method: 'POST',
        body: formData,
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || '提交失败，请重试')
      }

      const { record } = await res.json()
      setRecords(prev => [record, ...prev])
      setFile(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
    } catch (err) {
      setError(err instanceof Error ? err.message : '提交失败，请重试')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Upload area */}
      <div className="card">
        <h2 className="text-base font-semibold text-gray-900 mb-4">上传规划书</h2>

        <div
          className={`
            relative border-2 border-dashed rounded-xl p-8 text-center transition-colors
            ${file ? 'border-indigo-300 bg-indigo-50' : 'border-gray-200 bg-gray-50 hover:border-indigo-300 hover:bg-indigo-50/30'}
          `}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault()
            const f = e.dataTransfer.files[0]
            if (f) {
              const fakeEvent = { target: { files: [f] } } as unknown as React.ChangeEvent<HTMLInputElement>
              handleFileChange(fakeEvent)
            }
          }}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf"
            onChange={handleFileChange}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          />
          {file ? (
            <div className="flex flex-col items-center gap-2">
              <span className="text-3xl">📄</span>
              <p className="text-sm font-medium text-indigo-700">{file.name}</p>
              <p className="text-xs text-indigo-500">{(file.size / 1024).toFixed(0)} KB</p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <span className="text-3xl text-gray-300">📂</span>
              <p className="text-sm font-medium text-gray-600">点击或拖拽上传规划书</p>
              <p className="text-xs text-gray-400">仅支持 PDF 格式，最大 20MB</p>
            </div>
          )}
        </div>

        {error && (
          <p className="mt-3 text-sm text-red-600">{error}</p>
        )}

        <button
          onClick={handleSubmit}
          disabled={!file || submitting}
          className="mt-4 w-full py-2.5 px-4 rounded-lg font-medium text-sm transition-all
            bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {submitting ? '正在提交...' : '开始分析'}
        </button>
      </div>

      {/* Records list */}
      {records.length > 0 && (
        <div>
          <h2 className="text-base font-semibold text-gray-900 mb-3">历史记录</h2>
          <div className="space-y-3">
            {records.map(record => (
              <RecordCard
                key={record.id}
                record={record}
                onStatusUpdate={handleStatusUpdate}
              />
            ))}
          </div>
        </div>
      )}

      {records.length === 0 && (
        <div className="text-center py-12 text-gray-400">
          <p className="text-4xl mb-3">📭</p>
          <p className="text-sm">还没有提交过规划书，上传后即可开始分析</p>
        </div>
      )}
    </div>
  )
}
