'use client'

import { useEffect, useState } from 'react'

type Draft = {
  id: string
  name: string | null
  gender: string | null
  startDate: string | null
  endDate: string | null
  companyName: string
  templateMode: 'SYSTEM' | 'CUSTOM'
  status: 'PROCESSING' | 'COMPLETED' | 'ISSUED' | 'REJECTED' | 'FAILED'
  errorMsg: string | null
  rejectionReason: string | null
  createdAt: string
  completedAt: string | null
  issuedAt: string | null
  rejectedAt: string | null
  downloadUrl: string | null
}

type Mode = 'SYSTEM' | 'CUSTOM'

export default function InternshipCertificateClient({
  teacherId,
  initialName,
  initialGender,
  initialDraft,
}: {
  teacherId: string
  initialName: string
  initialGender: string
  initialDraft: Draft | null
}) {
  const [editing, setEditing] = useState(!initialDraft)
  const [mode, setMode] = useState<Mode>(initialDraft?.templateMode ?? 'SYSTEM')
  const [name, setName] = useState(initialDraft?.name ?? initialName)
  const [gender, setGender] = useState(initialDraft?.gender ?? initialGender)
  const [idCard, setIdCard] = useState('')
  const [startDate, setStartDate] = useState(initialDraft?.startDate ?? '')
  const [endDate, setEndDate] = useState(initialDraft?.endDate ?? '')
  const [pdfKey, setPdfKey] = useState('')
  const [pdfName, setPdfName] = useState('')
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [draft, setDraft] = useState<Draft | null>(initialDraft)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!draft || draft.status !== 'PROCESSING') return
    const timer = window.setInterval(async () => {
      const response = await fetch(`/api/tools/internship-certificate/${draft.id}`, { cache: 'no-store' })
      if (!response.ok) return
      const data = await response.json() as { draft: Draft }
      setDraft(data.draft)
      if (data.draft.status !== 'PROCESSING') setEditing(false)
    }, 2000)
    return () => window.clearInterval(timer)
  }, [draft?.id, draft?.status])

  const uploadPdf = async (file: File) => {
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      setError('实习证明必须为 PDF 格式')
      return
    }
    setError('')
    setUploading(true)
    setUploadProgress(0)
    try {
      const tokenRes = await fetch('/api/upload/internship-certificate-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teacherId, fileName: file.name }),
      })
      const tokenData = await tokenRes.json()
      if (!tokenRes.ok) throw new Error(tokenData.error || '获取上传凭证失败')
      const { uploadToken, key, uploadUrl } = tokenData
      const formData = new FormData()
      formData.append('file', file)
      formData.append('token', uploadToken)
      formData.append('key', key)
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest()
        xhr.upload.addEventListener('progress', (e) => {
          if (e.lengthComputable) setUploadProgress(Math.round((e.loaded / e.total) * 100))
        })
        xhr.addEventListener('load', () => {
          if (xhr.status === 200) {
            setPdfKey(key)
            setPdfName(file.name)
            resolve()
          } else {
            reject(new Error('上传失败，请重试'))
          }
        })
        xhr.addEventListener('error', () => reject(new Error('网络错误，请检查后重试')))
        xhr.addEventListener('timeout', () => reject(new Error('上传超时，请重试')))
        xhr.open('POST', uploadUrl)
        xhr.timeout = 300000
        xhr.send(formData)
      })
      setUploadProgress(100)
    } catch (err) {
      setError(err instanceof Error ? err.message : '上传失败，请重试')
    } finally {
      setUploading(false)
    }
  }

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setError('')

    if (mode === 'SYSTEM') {
      if (!name.trim() || !gender || !idCard.trim() || !startDate || !endDate) {
        setError('请完整填写所有字段')
        return
      }
      if (!/^\d{17}[\dXx]$/.test(idCard.trim())) {
        setError('请输入有效的18位身份证号')
        return
      }
      if (startDate > endDate) {
        setError('实习开始日期不能晚于结束日期')
        return
      }
    } else {
      if (!pdfKey) {
        setError('请先上传实习证明 PDF')
        return
      }
    }

    setSubmitting(true)
    try {
      const body =
        mode === 'SYSTEM'
          ? { templateMode: 'SYSTEM', name, gender, idCard, startDate, endDate }
          : { templateMode: 'CUSTOM', pdfKey }
      const response = await fetch('/api/tools/internship-certificate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await response.json() as { draft?: Draft; error?: string }
      if (!response.ok || !data.draft) {
        setError(data.error || '提交失败，请稍后重试')
        if (data.draft) setDraft(data.draft)
        return
      }
      setDraft(data.draft)
      setEditing(false)
      setPdfKey('')
      setPdfName('')
    } catch {
      setError('网络异常，请稍后重试')
    } finally {
      setSubmitting(false)
    }
  }

  const startEdit = () => {
    if (draft) {
      setMode(draft.templateMode)
      setName(draft.name ?? initialName)
      setGender(draft.gender ?? initialGender)
      setStartDate(draft.startDate ?? '')
      setEndDate(draft.endDate ?? '')
    }
    setPdfKey('')
    setPdfName('')
    setError('')
    setEditing(true)
  }

  // 已有申请且不在编辑态：展示状态卡片
  if (draft && !editing) {
    return (
      <div className="card">
        {draft.status === 'PROCESSING' ? (
          <div className="text-center py-10">
            <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-indigo-200 border-t-indigo-600" />
            <h2 className="text-lg font-semibold text-gray-900">申请处理中</h2>
            <p className="mt-2 text-sm text-gray-500">正在生成申请材料，请不要关闭页面。</p>
          </div>
        ) : draft.status === 'COMPLETED' ? (
          <div className="text-center py-8">
            <div className="text-4xl mb-3">⏳</div>
            <h2 className="text-lg font-semibold text-gray-900">待开具</h2>
            <p className="mt-2 text-sm text-gray-500">申请已提交，等待单位审核开具实习证明，开具完毕后可在此下载。</p>
          </div>
        ) : draft.status === 'ISSUED' ? (
          <div className="text-center py-8">
            <div className="text-4xl mb-3">✅</div>
            <h2 className="text-lg font-semibold text-gray-900">开具完毕</h2>
            <p className="mt-2 text-sm text-gray-500">实习证明已开具，请下载保存。</p>
            {draft.downloadUrl && (
              <a href={draft.downloadUrl} download className="mt-5 inline-flex rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-indigo-700">
                下载实习证明 PDF
              </a>
            )}
          </div>
        ) : draft.status === 'REJECTED' ? (
          <div className="py-6">
            <div className="text-center mb-4">
              <div className="text-4xl mb-3">⚠️</div>
              <h2 className="text-lg font-semibold text-gray-900">申请已打回</h2>
              <p className="mt-2 text-sm text-gray-500">请根据以下说明修改后重新提交。</p>
            </div>
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              <div className="font-medium mb-1">打回原因：</div>
              <div>{draft.rejectionReason || '请联系管理员了解详情'}</div>
            </div>
            <div className="text-center mt-5">
              <button type="button" onClick={startEdit} className="inline-flex rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-indigo-700">
                修改并重新提交
              </button>
            </div>
          </div>
        ) : (
          <div className="py-6">
            <div className="text-center mb-4">
              <div className="text-4xl mb-3">❌</div>
              <h2 className="text-lg font-semibold text-gray-900">生成失败</h2>
              <p className="mt-2 text-sm text-red-600">{draft.errorMsg || '未知错误'}</p>
            </div>
            <div className="text-center">
              <button type="button" onClick={startEdit} className="inline-flex rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-indigo-700">
                重新提交
              </button>
            </div>
          </div>
        )}
      </div>
    )
  }

  // 编辑态 / 首次申请
  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        提交申请后，单位将审核并开具实习证明。开具完毕后可在此页面下载正式 PDF。
      </div>

      {/* 模板选择 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <button
          type="button"
          onClick={() => setMode('SYSTEM')}
          className={`text-left p-4 rounded-xl border-2 transition-all ${mode === 'SYSTEM' ? 'border-indigo-500 bg-indigo-50' : 'border-gray-200 bg-white hover:border-gray-300'}`}
        >
          <div className="flex items-center gap-2 mb-1">
            <span className="text-lg">📄</span>
            <span className="font-semibold text-gray-900">系统默认模板</span>
            {mode === 'SYSTEM' && <span className="ml-auto text-xs font-medium px-2 py-0.5 rounded-full bg-indigo-600 text-white">已选</span>}
          </div>
          <p className="text-xs text-gray-500">填写信息，由系统生成证明，无需上传 PDF</p>
        </button>
        <button
          type="button"
          onClick={() => setMode('CUSTOM')}
          className={`text-left p-4 rounded-xl border-2 transition-all ${mode === 'CUSTOM' ? 'border-indigo-500 bg-indigo-50' : 'border-gray-200 bg-white hover:border-gray-300'}`}
        >
          <div className="flex items-center gap-2 mb-1">
            <span className="text-lg">🏫</span>
            <span className="font-semibold text-gray-900">自定义模板</span>
            {mode === 'CUSTOM' && <span className="ml-auto text-xs font-medium px-2 py-0.5 rounded-full bg-indigo-600 text-white">已选</span>}
          </div>
          <p className="text-xs text-gray-500">使用学校/单位的实习证明模板，上传 PDF</p>
        </button>
      </div>

      <form onSubmit={submit} className="card space-y-5">
        {mode === 'SYSTEM' ? (
          <>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">姓名</label>
              <input className="input" value={name} onChange={(e) => setName(e.target.value)} maxLength={40} required />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">性别</label>
              <div className="flex gap-5">
                {['男', '女'].map((value) => (
                  <label key={value} className="flex items-center gap-2 text-sm text-gray-700">
                    <input type="radio" name="certificate-gender" value={value} checked={gender === value} onChange={() => setGender(value)} required />
                    {value}
                  </label>
                ))}
              </div>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">身份证号</label>
              <input className="input font-mono" value={idCard} onChange={(e) => setIdCard(e.target.value.toUpperCase())} placeholder="请输入18位身份证号" maxLength={18} required />
            </div>
            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">实习开始日期</label>
                <input type="date" className="input" value={startDate} onChange={(e) => setStartDate(e.target.value)} required />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">实习结束日期</label>
                <input type="date" className="input" value={endDate} onChange={(e) => setEndDate(e.target.value)} required />
              </div>
            </div>
            <p className="text-sm text-gray-500">单位名称固定为：北京一生二科技有限公司；证明日期自动使用实习结束日期。</p>
          </>
        ) : (
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">上传实习证明 PDF</label>
            <input
              type="file"
              accept="application/pdf,.pdf"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadPdf(f) }}
              disabled={uploading}
              className="block w-full text-sm text-gray-600 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
            />
            {uploading && <p className="mt-2 text-sm text-indigo-600">上传中… {uploadProgress}%</p>}
            {pdfName && !uploading && <p className="mt-2 text-sm text-green-700">已上传：{pdfName}</p>}
          </div>
        )}

        {error && <p className="text-sm text-red-600">{error}</p>}
        <button type="submit" disabled={submitting || uploading} className="w-full rounded-lg bg-indigo-600 px-5 py-3 font-medium text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60">
          {submitting ? '提交中…' : '提交申请'}
        </button>
      </form>
    </div>
  )
}
