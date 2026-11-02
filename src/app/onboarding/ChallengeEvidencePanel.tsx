'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { resubmitCoachReview } from '@/app/actions/coachReview'
import { saveChallengeEvidence } from '@/app/actions/teacherQualification'
import { QUALIFICATION_TYPE_LABELS } from '@/lib/teacherQualificationShared'
import type { QualificationType } from '@/lib/teacherQualificationShared'

interface Props {
  challenge: {
    note: string
    items: QualificationType[]
    challengedByName: string | null
    challengedAt: string
  }
  /** 质疑发起后各要求项已补交的份数（服务端按 challengedAt 过滤） */
  evidenceCounts: Record<string, number>
}

/**
 * 质疑取证补证卡片（教练端）：
 * 审核人对资料存疑打回后，教练按要求逐项补交证明，全部补齐后可重新提交审核。
 */
export default function ChallengeEvidencePanel({ challenge, evidenceCounts }: Props) {
  const router = useRouter()
  const [uploadingType, setUploadingType] = useState<QualificationType | null>(null)
  const [resubmitting, setResubmitting] = useState(false)
  const [error, setError] = useState('')

  const allSatisfied = challenge.items.every((item) => (evidenceCounts[item] ?? 0) > 0)

  const handleUpload = async (type: QualificationType, file: File) => {
    setError('')
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
      const result = await saveChallengeEvidence({ type, files: [data.key] })
      if (!result.success) {
        alert(result.error || '提交失败，请重试')
        return
      }
      router.refresh()
    } catch {
      alert('提交失败，请重试')
    } finally {
      setUploadingType(null)
    }
  }

  const handleResubmit = async () => {
    if (!allSatisfied) {
      setError('请先按要求补齐全部证明材料')
      return
    }
    if (!confirm('确认已补齐全部要求的证明材料，并重新提交审核？')) return
    setResubmitting(true)
    setError('')
    try {
      const result = await resubmitCoachReview()
      if (!result.success) {
        setError(result.error || '提交失败，请重试')
        return
      }
      router.refresh()
    } finally {
      setResubmitting(false)
    }
  }

  return (
    <div className="mb-8 p-5 rounded-xl border-2 border-orange-300 bg-orange-50 text-orange-950 shadow-sm">
      <h2 className="text-lg font-bold text-orange-900 mb-1">质疑取证：请补充证明材料</h2>
      <p className="text-sm text-orange-900/90">
        审核人对您提交的部分资料存疑，请按要求补交以下证明材料；全部补齐后重新提交，
        将由发起质疑的审核人继续审核。
        {challenge.challengedByName && (
          <span className="ml-1">（质疑人：{challenge.challengedByName}）</span>
        )}
      </p>

      {challenge.note && (
        <div className="mt-3 p-3 rounded-lg bg-white/80 border border-orange-200">
          <p className="text-xs font-semibold text-orange-800 mb-1">质疑说明</p>
          <p className="text-sm text-orange-950 whitespace-pre-wrap">{challenge.note}</p>
        </div>
      )}

      <div className="mt-4 space-y-3">
        {challenge.items.map((item) => {
          const count = evidenceCounts[item] ?? 0
          const satisfied = count > 0
          return (
            <div
              key={item}
              className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between rounded-lg bg-white/80 border border-orange-200 p-3"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-900">
                  {QUALIFICATION_TYPE_LABELS[item] ?? item}
                  <span
                    className={`ml-2 text-xs px-2 py-0.5 rounded-full ${
                      satisfied ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-700'
                    }`}
                  >
                    {satisfied ? `已补交 ${count} 份` : '待补交'}
                  </span>
                </p>
                {item === 'GAOKAO_SCORE' && (
                  <p className="text-xs text-gray-500 mt-0.5">
                    上传高考成绩查询截图（推荐学信网 www.chsi.com.cn 查询/认证结果，含姓名与成绩）
                  </p>
                )}
                {item === 'DEGREE_CERT' && (
                  <p className="text-xs text-gray-500 mt-0.5">
                    上传学信网在线验证报告（截图或 PDF）
                  </p>
                )}
                {item === 'TEACHER_CERT' && (
                  <p className="text-xs text-gray-500 mt-0.5">上传教师资格证证书照片</p>
                )}
                {item === 'MANDARIN_CERT' && (
                  <p className="text-xs text-gray-500 mt-0.5">上传普通话等级证书照片</p>
                )}
              </div>
              <label
                className={`shrink-0 inline-flex items-center justify-center px-4 py-2 rounded-lg border border-dashed border-gray-300 text-xs text-gray-600 cursor-pointer hover:border-orange-400 hover:text-orange-600 transition-colors ${
                  uploadingType === item ? 'opacity-50 pointer-events-none' : ''
                }`}
              >
                {uploadingType === item ? '上传中…' : satisfied ? '再补一份' : '上传补交（图片/PDF）'}
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp,application/pdf"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) handleUpload(item, file)
                    e.target.value = ''
                  }}
                />
              </label>
            </div>
          )
        })}
      </div>

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

      <div className="mt-4">
        <button
          onClick={handleResubmit}
          disabled={resubmitting || !allSatisfied}
          className="px-5 py-2.5 rounded-lg bg-orange-600 hover:bg-orange-700 text-white text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {resubmitting ? '提交中…' : allSatisfied ? '重新提交审核' : '补齐材料后可重新提交'}
        </button>
      </div>
    </div>
  )
}
