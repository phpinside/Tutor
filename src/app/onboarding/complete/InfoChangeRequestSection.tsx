'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { GAOKAO_PROVINCE_OPTIONS } from '@/lib/gaokaoProvinces'
import { SENSITIVE_FIELD_LABELS } from '@/lib/teacherSensitiveFields'
import type { SensitiveField } from '@/lib/teacherSensitiveFields'
import AuthenticityDeclaration from '@/components/AuthenticityDeclaration'
import {
  INFO_CHANGE_STATUS_LABELS,
  INFO_CHANGE_STATUS_BADGE,
  MAX_PROOF_IMAGES,
  MAX_REASON_LENGTH,
} from '@/lib/teacherInfoChangeShared'
import type { InfoChangeItemView } from '@/lib/teacherInfoChangeShared'
import {
  submitInfoChangeRequest,
  cancelInfoChangeRequest,
  getMyInfoChangeRequests,
} from '@/app/actions/teacherInfoChangeRequest'

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
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

interface Props {
  teacherId: string
  currentValues: Record<SensitiveField, string>
  initialRequests: InfoChangeItemView[]
}

const CHECKLIST_ITEMS = [
  '截图来自学信网、省教育考试院官网、官方查分小程序或官方短信等官方渠道，非他人转发',
  '截图中姓名与所申请科目的成绩清晰可辨',
  '已遮挡准考证号、身份证号等无关个人信息（无需提供身份证照片）',
  '未对成绩数字做任何修改，截图未经过处理',
]

/** 推荐查询渠道（按可验证性排序：学信网可在线核验 > 考试院电子证明 > 查分截图） */
const PROOF_CHANNELS: { tag: string; tagClass: string; title: string; steps: string[] }[] = [
  {
    tag: '首选 · 可在线核验',
    tagClass: 'bg-green-100 text-green-800',
    title: '学信网高考成绩查询 / 认证',
    steps: [
      '登录学信网 www.chsi.com.cn',
      '进入「学籍学历 / 成绩与学历认证」栏目',
      '完成实名注册登录后查询高考成绩',
      '如可出具高考成绩认证报告，截图请包含报告编号与在线验证码，便于审核在线核验',
    ],
  },
  {
    tag: '推荐',
    tagClass: 'bg-blue-100 text-blue-800',
    title: '省教育考试院官网 / 官方小程序',
    steps: ['在参加高考省份的考试院官方渠道查询成绩', '如支持开具带验证码的电子成绩证明，请一并截图'],
  },
  {
    tag: '兜底',
    tagClass: 'bg-gray-100 text-gray-700',
    title: '官方查分短信',
    steps: ['使用运营商下发的官方查分短信截图'],
  },
]

export default function InfoChangeRequestSection({
  teacherId,
  currentValues,
  initialRequests,
}: Props) {
  const router = useRouter()
  const [requests, setRequests] = useState<InfoChangeItemView[]>(initialRequests)
  const [modalOpen, setModalOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [cancellingId, setCancellingId] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState('')

  // 表单状态
  const [form, setForm] = useState({
    name: currentValues.name ?? '',
    gaokaoProvince: currentValues.gaokaoProvince ?? '',
    mathScore: currentValues.mathScore ?? '',
    physicsScore: currentValues.physicsScore ?? '',
    chemistryScore: currentValues.chemistryScore ?? '',
  })
  const [reason, setReason] = useState('')
  const [proofImages, setProofImages] = useState<{ key: string; previewUrl: string }[]>([])
  const [uploading, setUploading] = useState(false)
  const [checklist, setChecklist] = useState<boolean[]>(CHECKLIST_ITEMS.map(() => false))
  const [commitmentAccepted, setCommitmentAccepted] = useState(false)

  const hasPendingRequest = requests.some(
    (r) => r.status === 'PENDING_FIRST_REVIEW' || r.status === 'PENDING_FINAL_REVIEW'
  )

  const openModal = () => {
    setForm({
      name: currentValues.name ?? '',
      gaokaoProvince: currentValues.gaokaoProvince ?? '',
      mathScore: currentValues.mathScore ?? '',
      physicsScore: currentValues.physicsScore ?? '',
      chemistryScore: currentValues.chemistryScore ?? '',
    })
    setReason('')
    setProofImages([])
    setChecklist(CHECKLIST_ITEMS.map(() => false))
    setCommitmentAccepted(false)
    setErrorMsg('')
    setModalOpen(true)
  }

  const refreshRequests = async () => {
    const result = await getMyInfoChangeRequests()
    if (result.success && result.requests) setRequests(result.requests)
    router.refresh()
  }

  const handleUpload = async (file: File) => {
    if (proofImages.length >= MAX_PROOF_IMAGES) {
      alert(`最多上传 ${MAX_PROOF_IMAGES} 张截图`)
      return
    }
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
      alert('只支持 PNG、JPG、WEBP 格式的图片')
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      alert('图片大小不能超过 10MB')
      return
    }
    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await fetch('/api/upload/info-change-proof', {
        method: 'POST',
        body: formData,
      })
      const data = await res.json()
      if (!res.ok || !data.success) {
        alert(data.error || '上传失败，请重试')
        return
      }
      setProofImages((prev) => [...prev, { key: data.key, previewUrl: URL.createObjectURL(file) }])
    } catch {
      alert('上传失败，请重试')
    } finally {
      setUploading(false)
    }
  }

  const handleRemoveProof = (index: number) => {
    setProofImages((prev) => prev.filter((_, i) => i !== index))
  }

  const handleSubmit = async () => {
    setErrorMsg('')
    if (!checklist.every(Boolean)) {
      setErrorMsg('请先确认全部注意事项后勾选')
      return
    }
    if (!commitmentAccepted) {
      setErrorMsg('请先阅读「信息真实性承诺」并勾选确认')
      return
    }
    if (proofImages.length === 0) {
      setErrorMsg('请上传高考成绩查询截图作为证明材料')
      return
    }

    // 仅提交有实际变化的字段
    const changes: Record<string, string | number> = {}
    if (form.name.trim() && form.name.trim() !== (currentValues.name ?? '')) {
      changes.name = form.name.trim()
    }
    if (form.gaokaoProvince && form.gaokaoProvince !== (currentValues.gaokaoProvince ?? '')) {
      changes.gaokaoProvince = form.gaokaoProvince
    }
    for (const field of ['mathScore', 'physicsScore', 'chemistryScore'] as const) {
      const raw = String(form[field]).trim()
      if (raw === '') continue
      const num = parseInt(raw, 10)
      if (Number.isNaN(num)) {
        setErrorMsg(`${SENSITIVE_FIELD_LABELS[field]}需填写数字`)
        return
      }
      if (String(num) !== (currentValues[field] ?? '')) {
        changes[field] = num
      }
    }
    if (Object.keys(changes).length === 0) {
      setErrorMsg('请至少修改一项内容后再提交')
      return
    }

    setSubmitting(true)
    try {
      const result = await submitInfoChangeRequest({
        changes: changes as never,
        proofImages: proofImages.map((p) => p.key),
        reason: reason.trim() || undefined,
        commitmentAccepted: true,
      })
      if (!result.success) {
        setErrorMsg(result.error || '提交失败，请重试')
        return
      }
      setModalOpen(false)
      await refreshRequests()
    } catch {
      setErrorMsg('提交失败，请重试')
    } finally {
      setSubmitting(false)
    }
  }

  const handleCancel = async (requestId: string) => {
    if (!confirm('确定撤回该申请吗？')) return
    setCancellingId(requestId)
    try {
      const result = await cancelInfoChangeRequest(requestId)
      if (!result.success) {
        alert(result.error || '撤回失败')
        return
      }
      await refreshRequests()
    } finally {
      setCancellingId(null)
    }
  }

  const loadProofUrl = async (key: string): Promise<string | null> => {
    try {
      const res = await fetch(`/api/upload/info-change-proof-signed?key=${encodeURIComponent(key)}`)
      const data = await res.json()
      return data.url ?? null
    } catch {
      return null
    }
  }

  return (
    <div className="mb-8 rounded-xl border border-gray-200 bg-gray-50/80 p-5">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">高考资料修改申请</h2>
          <p className="text-sm text-gray-600 mt-1">
            姓名、高考省份与高考成绩属于重要资料，入驻审核通过后不可直接修改；
            如需修改请提交申请并上传成绩查询截图，经学管初审、运营复审通过后生效。
            <span className="text-red-700 font-medium">
              所提交资料必须真实有效，如经查实存在虚假或伪造情形，将被解除合作（开除）并永久拒绝入驻。
            </span>
          </p>
        </div>
        <button
          onClick={openModal}
          disabled={hasPendingRequest}
          className="shrink-0 inline-flex items-center justify-center px-4 py-2 rounded-lg bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {hasPendingRequest ? '有申请审核中' : '申请修改'}
        </button>
      </div>

      {/* 当前值 */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-4">
        {FIELD_ORDER.map((field) => (
          <div key={field} className="rounded-lg bg-white border border-gray-200 p-3">
            <p className="text-xs text-gray-500 mb-1">{SENSITIVE_FIELD_LABELS[field]}</p>
            <p className="text-sm font-medium text-gray-900 break-all">
              {formatValue(currentValues[field])}
            </p>
          </div>
        ))}
      </div>

      {/* 历史申请 */}
      {requests.length > 0 && (
        <div className="space-y-3">
          <p className="text-sm font-medium text-gray-700">申请记录</p>
          {requests.map((req) => (
            <div key={req.id} className="rounded-lg border border-gray-200 bg-white p-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`badge text-xs ${INFO_CHANGE_STATUS_BADGE[req.status]}`}>
                    {INFO_CHANGE_STATUS_LABELS[req.status]}
                  </span>
                  <span className="text-xs text-gray-400">提交于 {formatTime(req.createdAt)}</span>
                </div>
                {req.status === 'PENDING_FIRST_REVIEW' && (
                  <button
                    onClick={() => handleCancel(req.id)}
                    disabled={cancellingId === req.id}
                    className="text-xs text-gray-500 hover:text-red-600 underline underline-offset-2 disabled:opacity-50"
                  >
                    {cancellingId === req.id ? '撤回中…' : '撤回申请'}
                  </button>
                )}
              </div>
              <div className="mt-2 space-y-1">
                {Object.entries(req.changes).map(([field, change]) => (
                  <p key={field} className="text-sm text-gray-700">
                    <span className="text-gray-500">{SENSITIVE_FIELD_LABELS[field as SensitiveField] ?? field}：</span>
                    {formatValue(change.from)} → <span className="font-medium">{formatValue(change.to)}</span>
                  </p>
                ))}
              </div>
              {req.reason && (
                <p className="mt-1 text-xs text-gray-500">修改说明：{req.reason}</p>
              )}
              {(req.firstReviewNote || req.finalReviewNote) && (
                <div className="mt-2 space-y-1">
                  {req.firstReviewNote && (
                    <p className="text-xs text-gray-500">初审意见（{req.firstReviewerName ?? '-'}）：{req.firstReviewNote}</p>
                  )}
                  {req.finalReviewNote && (
                    <p className="text-xs text-gray-500">复审意见（{req.finalReviewerName ?? '-'}）：{req.finalReviewNote}</p>
                  )}
                </div>
              )}
              <ProofThumbnails images={req.proofImages} loadUrl={loadProofUrl} />
            </div>
          ))}
        </div>
      )}

      {/* 申请弹窗 */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl w-full max-w-2xl my-8">
            <div className="p-6 border-b border-gray-100">
              <h3 className="text-lg font-bold text-gray-900">申请修改高考资料</h3>
              <p className="text-sm text-gray-500 mt-1">
                提交后由学管初审、运营复审，全部通过后自动生效；审核中不可重复提交。
              </p>
            </div>

            <div className="p-6 space-y-5 max-h-[60vh] overflow-y-auto">
              {/* 诚实申报提醒（显著横幅） */}
              <AuthenticityDeclaration variant="banner" />

              {/* 示例截图示意 */}
              <div className="rounded-xl border-2 border-dashed border-primary-300 bg-primary-50/60 p-4">
                <p className="text-sm font-semibold text-primary-900 mb-2">📸 证明材料要求：高考成绩查询结果截图</p>
                <div className="flex flex-col sm:flex-row gap-4">
                  <div className="sm:w-48 shrink-0">
                    <div className="rounded-lg border-2 border-red-400 bg-white p-3 text-xs">
                      <p className="text-gray-400 text-center text-[10px] mb-2">××省教育考试院 · 成绩查询</p>
                      <div className="space-y-1">
                        <p>
                          <span className="text-gray-500">姓名：</span>
                          <span className="font-bold text-red-500 bg-red-100 rounded px-1">张同学</span>
                        </p>
                        <p>
                          <span className="text-gray-500">数学：</span>
                          <span className="font-bold text-red-500 bg-red-100 rounded px-1">142</span>
                        </p>
                        <p>
                          <span className="text-gray-500">物理：</span>
                          <span className="font-bold text-red-500 bg-red-100 rounded px-1">95</span>
                        </p>
                        <p className="text-gray-300 blur-[2px] select-none">准考证号：24xxxxxxxxxx</p>
                      </div>
                    </div>
                    <p className="text-[10px] text-gray-400 mt-1 text-center">示例：红框要素需清晰可见</p>
                  </div>
                  <ul className="text-sm text-gray-700 space-y-1.5 list-disc list-inside">
                    <li>截图需包含<span className="font-medium">姓名、省份（查询渠道）、所申请科目成绩</span></li>
                    <li>请遮挡准考证号、身份证号等信息，<span className="font-medium">无需上传身份证</span></li>
                    <li>图片清晰、未修改；支持 PNG / JPG / WEBP，单张 ≤10MB，最多 {MAX_PROOF_IMAGES} 张</li>
                  </ul>
                </div>

                {/* 推荐查询渠道（分步引导，按可验证性排序） */}
                <div className="mt-4 rounded-lg bg-white/80 border border-primary-100 p-3">
                  <p className="text-xs font-semibold text-gray-700 mb-2">推荐查询渠道（按优先级任选其一）</p>
                  <div className="space-y-2.5">
                    {PROOF_CHANNELS.map((channel, idx) => (
                      <div key={idx} className="flex gap-2.5">
                        <span className={`shrink-0 self-start px-1.5 py-0.5 rounded text-[10px] font-medium ${channel.tagClass}`}>
                          {channel.tag}
                        </span>
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-gray-800">{channel.title}</p>
                          <ol className="text-xs text-gray-500 leading-relaxed list-decimal list-inside">
                            {channel.steps.map((step, sIdx) => (
                              <li key={sIdx}>{step}</li>
                            ))}
                          </ol>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* 字段表单 */}
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">姓名</label>
                  <input
                    value={form.name}
                    onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-primary-400 focus:outline-none"
                    placeholder={formatValue(currentValues.name)}
                  />
                  <p className="text-xs text-gray-400 mt-1">当前：{formatValue(currentValues.name)}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">高考省份</label>
                  <select
                    value={form.gaokaoProvince}
                    onChange={(e) => setForm((p) => ({ ...p, gaokaoProvince: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:border-primary-400 focus:outline-none"
                  >
                    <option value="">请选择（不修改则留空）</option>
                    {GAOKAO_PROVINCE_OPTIONS.map((p) => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-400 mt-1">当前：{formatValue(currentValues.gaokaoProvince)}</p>
                </div>
                {(['mathScore', 'physicsScore', 'chemistryScore'] as const).map((field) => (
                  <div key={field}>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {SENSITIVE_FIELD_LABELS[field]}
                    </label>
                    <input
                      type="number"
                      value={form[field]}
                      onChange={(e) => setForm((p) => ({ ...p, [field]: e.target.value }))}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-primary-400 focus:outline-none"
                      placeholder="不修改则留空"
                    />
                    <p className="text-xs text-gray-400 mt-1">当前：{formatValue(currentValues[field])}</p>
                  </div>
                ))}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    修改说明（选填，≤{MAX_REASON_LENGTH} 字）
                  </label>
                  <textarea
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    rows={3}
                    maxLength={MAX_REASON_LENGTH}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-primary-400 focus:outline-none resize-none"
                    placeholder="例如：当时填错了，现更正为实际成绩"
                  />
                </div>
              </div>

              {/* 上传截图 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  高考成绩查询截图 <span className="text-red-500">*</span>
                </label>
                <div className="flex flex-wrap gap-3">
                  {proofImages.map((img, idx) => (
                    <div key={img.key} className="relative">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={img.previewUrl}
                        alt={`证明材料 ${idx + 1}`}
                        className="w-24 h-24 object-cover rounded-lg border border-gray-200"
                      />
                      <button
                        type="button"
                        onClick={() => handleRemoveProof(idx)}
                        className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-red-500 text-white text-xs flex items-center justify-center shadow"
                        aria-label="删除截图"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                  {proofImages.length < MAX_PROOF_IMAGES && (
                    <label className="w-24 h-24 rounded-lg border-2 border-dashed border-gray-300 flex flex-col items-center justify-center text-gray-400 cursor-pointer hover:border-primary-400 hover:text-primary-500 transition-colors">
                      {uploading ? (
                        <span className="text-xs">上传中…</span>
                      ) : (
                        <>
                          <span className="text-2xl leading-none">＋</span>
                          <span className="text-xs mt-1">上传截图</span>
                        </>
                      )}
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        className="hidden"
                        disabled={uploading}
                        onChange={(e) => {
                          const file = e.target.files?.[0]
                          if (file) handleUpload(file)
                          e.target.value = ''
                        }}
                      />
                    </label>
                  )}
                </div>
              </div>

              {/* 确认清单 */}
              <div className="rounded-lg bg-gray-50 border border-gray-200 p-4">
                <p className="text-sm font-medium text-gray-800 mb-2">提交前请确认</p>
                <div className="space-y-2">
                  {CHECKLIST_ITEMS.map((item, idx) => (
                    <label key={idx} className="flex items-start gap-2 text-sm text-gray-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={checklist[idx]}
                        onChange={(e) =>
                          setChecklist((prev) => prev.map((c, i) => (i === idx ? e.target.checked : c)))
                        }
                        className="mt-0.5"
                      />
                      <span>{item}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* 信息真实性承诺（提交前必须确认） */}
              <AuthenticityDeclaration
                checked={commitmentAccepted}
                onChange={setCommitmentAccepted}
              />

              {errorMsg && <p className="text-sm text-red-600">{errorMsg}</p>}
            </div>

            <div className="p-6 border-t border-gray-100 flex justify-end gap-3">
              <button
                onClick={() => setModalOpen(false)}
                disabled={submitting}
                className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 text-sm hover:bg-gray-50 disabled:opacity-50"
              >
                取消
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitting || uploading}
                className="px-5 py-2 rounded-lg bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium disabled:opacity-50"
              >
                {submitting ? '提交中…' : '提交申请'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/** 历史申请中的证明截图缩略图（懒加载签名 URL） */
function ProofThumbnails({
  images,
  loadUrl,
}: {
  images: string[]
  loadUrl: (key: string) => Promise<string | null>
}) {
  const [urls, setUrls] = useState<Record<string, string>>({})

  if (images.length === 0) return null

  const handleLoad = async () => {
    const next: Record<string, string> = { ...urls }
    for (const key of images) {
      if (!next[key]) {
        const url = await loadUrl(key)
        if (url) next[key] = url
      }
    }
    setUrls(next)
  }

  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {images.map((key) => (
        <div key={key}>
          {urls[key] ? (
            <a href={urls[key]} target="_blank" rel="noopener noreferrer">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={urls[key]}
                alt="证明材料"
                onMouseEnter={handleLoad}
                className="w-16 h-16 object-cover rounded-md border border-gray-200 hover:opacity-90"
              />
            </a>
          ) : (
            <button
              onClick={handleLoad}
              className="w-16 h-16 rounded-md border border-dashed border-gray-300 text-xs text-gray-400 hover:border-primary-400 hover:text-primary-500"
            >
              查看截图
            </button>
          )}
        </div>
      ))}
    </div>
  )
}
