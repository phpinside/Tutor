'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { updateTeachingApproval } from '@/app/actions/teachingApproval'
import {
  TEACHING_APPROVAL_OPTIONS,
  TEACHING_APPROVAL_SUBJECT_OPTIONS,
  formatTeachingApprovalLevels,
  formatTeachingApprovalSubjects,
} from '@/lib/teachingApprovalShared'

function formatTime(iso: string | null): string {
  if (!iso) return '-'
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

interface Props {
  teacherId: string
  initialLevels: string[]
  initialSubjects: string[]
  updatedByName: string | null
  updatedAt: string | null
  /** 仅运营（OPERATOR）与超管可编辑；学管只读 */
  canEdit: boolean
  viewerIsLearnerManager: boolean
}

/**
 * 运营特批授课能力（学段 + 科目，内部属性）：
 * - 应用于教练可派单资格审查
 * - 教练不可见（数据存独立表，教练端不读取）
 * - 学管可见但不可修改；仅运营/超管可设置
 */
export default function TeachingApprovalSection({
  teacherId,
  initialLevels,
  initialSubjects,
  updatedByName,
  updatedAt,
  canEdit,
  viewerIsLearnerManager,
}: Props) {
  const router = useRouter()
  const [levels, setLevels] = useState<string[]>(initialLevels)
  const [subjects, setSubjects] = useState<string[]>(initialSubjects)
  const [modalOpen, setModalOpen] = useState(false)
  const [levelDraft, setLevelDraft] = useState<string[]>([])
  const [subjectDraft, setSubjectDraft] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const hasAny = levels.length > 0 || subjects.length > 0

  const openModal = () => {
    setLevelDraft([...levels])
    setSubjectDraft([...subjects])
    setError('')
    setModalOpen(true)
  }

  const toggle = (
    code: string,
    setter: React.Dispatch<React.SetStateAction<string[]>>
  ) => {
    setter((prev) => (prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]))
  }

  const handleSave = async () => {
    if (levelDraft.length === 0 && subjectDraft.length === 0 && hasAny) {
      if (!confirm('学段与科目均未勾选将清空该教练的全部特批授课能力，确定继续？')) return
    }
    setSaving(true)
    setError('')
    try {
      const result = await updateTeachingApproval(teacherId, levelDraft, subjectDraft)
      if (!result.success) {
        setError(result.error || '保存失败，请重试')
        return
      }
      setLevels(levelDraft)
      setSubjects(subjectDraft)
      setModalOpen(false)
      router.refresh()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="card mb-8">
      <div className="flex items-start justify-between gap-4 mb-3">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">特批授课能力（内部）</h2>
          <p className="text-sm text-gray-500 mt-1">
            用于教练可派单资格审查；教练本人不可见，
            {viewerIsLearnerManager ? '学管仅可查看，由运营设置。' : '由运营设置。'}
          </p>
        </div>
        {canEdit && (
          <button
            onClick={openModal}
            className="shrink-0 px-4 py-2 rounded-lg border border-gray-300 text-gray-700 text-sm font-medium hover:bg-gray-50 transition-colors"
          >
            {hasAny ? '修改特批' : '设置特批'}
          </button>
        )}
      </div>

      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-gray-500 shrink-0">学段：</span>
          {levels.length > 0 ? (
            formatTeachingApprovalLevels(levels)
              .split('、')
              .map((label) => (
                <span key={label} className="badge-primary text-sm">
                  ✔ {label}
                </span>
              ))
          ) : (
            <span className="text-sm text-gray-400">未设置</span>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-gray-500 shrink-0">科目：</span>
          {subjects.length > 0 ? (
            formatTeachingApprovalSubjects(subjects)
              .split('、')
              .map((label) => (
                <span key={label} className="badge-success text-sm">
                  ✔ {label}
                </span>
              ))
          ) : (
            <span className="text-sm text-gray-400">未设置</span>
          )}
        </div>
      </div>

      {(updatedByName || updatedAt) && (
        <p className="text-xs text-gray-400 mt-3">
          最后设置：{updatedByName ?? '-'} · {formatTime(updatedAt)}
        </p>
      )}

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="p-5 border-b border-gray-100">
              <h3 className="text-base font-bold text-gray-900">设置特批授课能力</h3>
              <p className="text-sm text-gray-500 mt-1">
                勾选该教练获得特批的授课学段与科目（均可多选）；保存后用于可派单资格审查，教练本人不可见。
              </p>
            </div>
            <div className="p-5 space-y-5">
              <div>
                <p className="text-sm font-medium text-gray-700 mb-2">授课学段</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {TEACHING_APPROVAL_OPTIONS.map((opt) => (
                    <label
                      key={opt.code}
                      className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2.5 cursor-pointer hover:bg-gray-50"
                    >
                      <input
                        type="checkbox"
                        checked={levelDraft.includes(opt.code)}
                        onChange={() => toggle(opt.code, setLevelDraft)}
                        className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                      />
                      <span className="text-sm text-gray-800">{opt.label}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-700 mb-2">授课科目</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {TEACHING_APPROVAL_SUBJECT_OPTIONS.map((opt) => (
                    <label
                      key={opt.code}
                      className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2.5 cursor-pointer hover:bg-gray-50"
                    >
                      <input
                        type="checkbox"
                        checked={subjectDraft.includes(opt.code)}
                        onChange={() => toggle(opt.code, setSubjectDraft)}
                        className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                      />
                      <span className="text-sm text-gray-800">{opt.label}</span>
                    </label>
                  ))}
                </div>
              </div>
              {error && <p className="text-sm text-red-600">{error}</p>}
            </div>
            <div className="p-5 border-t border-gray-100 flex justify-end gap-3">
              <button
                onClick={() => setModalOpen(false)}
                disabled={saving}
                className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 text-sm hover:bg-gray-50 disabled:opacity-50"
              >
                取消
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-5 py-2 rounded-lg bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium disabled:opacity-50"
              >
                {saving ? '保存中…' : '保存'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
