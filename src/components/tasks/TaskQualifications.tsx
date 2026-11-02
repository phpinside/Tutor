'use client'

import { useState } from 'react'
import {
  DEGREE_LEVELS,
  MANDARIN_LEVELS,
  TEACHER_CERT_STAGE_LABELS,
  TEACHER_CERT_STAGES,
  TEACHER_CERT_SUBJECT_LABELS,
  TEACHER_CERT_SUBJECTS,
} from '@/lib/teacherQualificationShared'
import type { QualificationMeta, QualificationType } from '@/lib/teacherQualificationShared'

const MAX_FILES = 2

export interface QualificationDraftItem {
  type: QualificationType
  files: string[]
  meta: QualificationMeta
}

export interface TaskQualificationsPayload {
  items: QualificationDraftItem[]
  isInServiceTeacher: boolean
}

interface FileEntry {
  key: string
}

interface Props {
  isInServiceTeacher: boolean
  initialItems: { type: QualificationType; files: string[]; meta: QualificationMeta }[]
  onChange: (payload: TaskQualificationsPayload, dirty: boolean) => void
}

const TYPE_TITLES: Record<Exclude<QualificationType, 'GAOKAO_SCORE'>, { title: string; hint: string }> = {
  DEGREE_CERT: {
    title: '学历学位证或在读学生证',
    hint: '上传学信网在线验证报告（截图或 PDF），报告自带在线验证码',
  },
  TEACHER_CERT: {
    title: '教师资格证',
    hint: '上传证书照片，并选择证书对应的学段与学科',
  },
  MANDARIN_CERT: {
    title: '普通话等级证',
    hint: '上传证书照片，并选择证书等级',
  },
}

/** 入驻表单「资质证明（选填）」：学历/在读证明、教师资格证、普通话等级证 + 是否在职教师 */
export default function TaskQualifications({ isInServiceTeacher, initialItems, onChange }: Props) {
  const [drafts, setDrafts] = useState<Record<string, FileEntry[] | null>>(() => {
    const initial: Record<string, FileEntry[] | null> = {
      DEGREE_CERT: null,
      TEACHER_CERT: null,
      MANDARIN_CERT: null,
    }
    for (const item of initialItems) {
      if (item.type === 'GAOKAO_SCORE') continue
      initial[item.type] = item.files.map((key) => ({ key }))
    }
    return initial
  })
  const [metas, setMetas] = useState<Record<string, QualificationMeta>>(() => {
    const initial: Record<string, QualificationMeta> = {}
    for (const item of initialItems) {
      if (item.type === 'GAOKAO_SCORE') continue
      initial[item.type] = item.meta ?? {}
    }
    return initial
  })
  const [inService, setInService] = useState(isInServiceTeacher)
  const [uploadingType, setUploadingType] = useState<string | null>(null)

  // 由 handler 显式传入计算后的最新状态再上报，避免 setState 异步导致的 stale payload
  // （修复：上传/选择后立即提交表单时，payload 丢失刚改动内容的问题）
  const emit = (
    nextDrafts: Record<string, FileEntry[] | null>,
    nextMetas: Record<string, QualificationMeta>,
    nextInService: boolean
  ) => {
    const items: QualificationDraftItem[] = []
    for (const type of ['DEGREE_CERT', 'TEACHER_CERT', 'MANDARIN_CERT'] as const) {
      const files = nextDrafts[type]
      if (!files || files.length === 0) continue
      items.push({ type, files: files.map((f) => f.key), meta: nextMetas[type] ?? {} })
    }
    onChange({ items, isInServiceTeacher: nextInService }, true)
  }

  const handleUpload = async (type: QualificationType, file: File) => {
    const current = drafts[type] ?? []
    if (current.length >= MAX_FILES) {
      alert(`最多上传 ${MAX_FILES} 个文件`)
      return
    }
    if (!['image/png', 'image/jpeg', 'image/webp', 'application/pdf'].includes(file.type)) {
      alert('只支持 PNG、JPG、WEBP 图片或 PDF 文件')
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      alert('文件大小不能超过 10MB')
      return
    }
    setUploadingType(type)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await fetch('/api/upload/qualification', { method: 'POST', body: formData })
      const data = await res.json()
      if (!res.ok || !data.success) {
        alert(data.error || '上传失败，请重试')
        return
      }
      const nextDrafts = { ...drafts, [type]: [...current, { key: data.key }] }
      setDrafts(nextDrafts)
      emit(nextDrafts, metas, inService)
    } catch {
      alert('上传失败，请重试')
    } finally {
      setUploadingType(null)
    }
  }

  const handleRemove = (type: QualificationType, index: number) => {
    const nextDrafts = {
      ...drafts,
      [type]: (drafts[type] ?? []).filter((_, i) => i !== index),
    }
    setDrafts(nextDrafts)
    emit(nextDrafts, metas, inService)
  }

  const handleMeta = (type: QualificationType, patch: QualificationMeta) => {
    const nextMetas = { ...metas, [type]: { ...metas[type], ...patch } }
    setMetas(nextMetas)
    emit(drafts, nextMetas, inService)
  }

  const renderSelect = (
    type: QualificationType,
    field: keyof QualificationMeta,
    options: readonly string[],
    labels?: Record<string, string>,
    placeholder = '请选择'
  ) => (
    <select
      value={(metas[type]?.[field] as string) ?? ''}
      onChange={(e) => handleMeta(type, { [field]: e.target.value } as QualificationMeta)}
      className="flex-1 border border-gray-300 rounded-lg px-2.5 py-2 text-sm bg-white focus:border-primary-400 focus:outline-none"
    >
      <option value="">{placeholder}</option>
      {options.map((opt) => (
        <option key={opt} value={opt}>
          {labels?.[opt] ?? opt}
        </option>
      ))}
    </select>
  )

  return (
    <div className="card">
      <h2 className="text-lg font-semibold text-gray-900 mb-1">
        资质证明（选填）
      </h2>
      <div className="rounded-lg bg-green-50 border border-green-200 px-3 py-2 mb-4 text-sm text-green-800">
        🎓 完善资质证明并通过审核后，将享有<span className="font-semibold">优先派单权</span>；
        提交的证书与报告须真实有效，将随入驻资料一并审核。
      </div>

      <div className="space-y-4">
        {(['DEGREE_CERT', 'TEACHER_CERT', 'MANDARIN_CERT'] as const).map((type) => {
          const files = drafts[type] ?? []
          const conf = TYPE_TITLES[type]
          return (
            <div key={type} className="rounded-xl border border-gray-200 p-4">
              <p className="text-sm font-medium text-gray-900">{conf.title}</p>
              <p className="text-xs text-gray-500 mt-0.5 mb-3">{conf.hint}</p>

              {/* 配套选择（移动端单列，≥sm 双列） */}
              {type === 'DEGREE_CERT' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                  {renderSelect(type, 'degreeLevel', DEGREE_LEVELS, undefined, '学历层次（选填）')}
                  <input
                    value={metas[type]?.verifyCode ?? ''}
                    onChange={(e) => handleMeta(type, { verifyCode: e.target.value })}
                    className="border border-gray-300 rounded-lg px-2.5 py-2 text-sm focus:border-primary-400 focus:outline-none"
                    placeholder="学信网在线验证码（选填）"
                    maxLength={50}
                  />
                </div>
              )}
              {type === 'TEACHER_CERT' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                  {renderSelect(type, 'certStage', TEACHER_CERT_STAGES, TEACHER_CERT_STAGE_LABELS, '学段')}
                  {renderSelect(type, 'certSubject', TEACHER_CERT_SUBJECTS, TEACHER_CERT_SUBJECT_LABELS, '学科')}
                </div>
              )}
              {type === 'MANDARIN_CERT' && (
                <div className="mb-3">
                  {renderSelect(type, 'mandarinLevel', MANDARIN_LEVELS, undefined, '等级')}
                </div>
              )}

              {/* 文件 */}
              <div className="flex flex-wrap items-center gap-2">
                {files.map((file, idx) => (
                  <span
                    key={file.key}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-gray-100 border border-gray-200 text-xs text-gray-700"
                  >
                    📎 文件{idx + 1}
                    <button
                      type="button"
                      onClick={() => handleRemove(type, idx)}
                      className="text-gray-400 hover:text-red-600"
                      aria-label="删除文件"
                    >
                      ×
                    </button>
                  </span>
                ))}
                {files.length < MAX_FILES && (
                  <label
                    className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-dashed border-gray-300 text-xs text-gray-500 cursor-pointer hover:border-primary-400 hover:text-primary-600 transition-colors ${
                      uploadingType === type ? 'opacity-50 pointer-events-none' : ''
                    }`}
                  >
                    {uploadingType === type ? '上传中…' : '＋ 上传（图片/PDF）'}
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp,application/pdf"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0]
                        if (file) handleUpload(type, file)
                        e.target.value = ''
                      }}
                    />
                  </label>
                )}
              </div>
            </div>
          )
        })}

        {/* 是否在职教师 */}
        <div className="rounded-xl border border-gray-200 p-4">
          <p className="text-sm font-medium text-gray-900 mb-2">是否在职教师</p>
          <div className="flex gap-6">
            {[{ v: false, label: '否' }, { v: true, label: '是' }].map((opt) => (
              <label key={opt.label} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="task-isInServiceTeacher"
                  checked={inService === opt.v}
                  onChange={() => {
                    setInService(opt.v)
                    emit(drafts, metas, opt.v)
                  }}
                  className="w-4 h-4 text-primary-600 border-gray-300 focus:ring-primary-500"
                />
                <span className="text-sm text-gray-700">{opt.label}</span>
              </label>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
