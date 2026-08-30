'use client'

import { useEffect, useMemo, useState } from 'react'

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

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat('zh-CN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
}

function statusLabel(status: Draft['status']) {
  return { PROCESSING: '生成中', COMPLETED: '待审核', ISSUED: '已开具', REJECTED: '已打回', FAILED: '生成失败' }[status]
}

export default function InternshipCertificateClient({ teacherId, initialName, initialGender, initialDrafts }: {
  teacherId: string
  initialName: string
  initialGender: string
  initialDrafts: Draft[]
}) {
  const [mode, setMode] = useState<Mode>('SYSTEM')
  const [name, setName] = useState(initialName)
  const [gender, setGender] = useState(initialGender)
  const [idCard, setIdCard] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [pdfKey, setPdfKey] = useState('')
  const [pdfName, setPdfName] = useState('')
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [records, setRecords] = useState<Draft[]>(initialDrafts)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const processingDraft = useMemo(() => records.find((record) => record.status === 'PROCESSING') ?? null, [records])

  useEffect(() => {
    if (!processingDraft) return
    const timer = window.setInterval(async () => {
      const response = await fetch(`/api/tools/internship-certificate/${processingDraft.id}`, { cache: 'no-store' })
      if (!response.ok) return
      const data = await response.json() as { draft: Draft }
      setRecords((previous) => [data.draft, ...previous.filter((record) => record.id !== data.draft.id)])
    }, 2000)
    return () => window.clearInterval(timer)
  }, [processingDraft?.id])

  const uploadPdf = async (file: File) => {
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      setError('实习证明必须为 PDF 格式')
      return
    }
    setError('')
    setUploading(true)
    setUploadProgress(0)
    try {
      const tokenResponse = await fetch('/api/upload/internship-certificate-pdf', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ teacherId, fileName: file.name }) })
      const tokenData = await tokenResponse.json()
      if (!tokenResponse.ok) throw new Error(tokenData.error || '获取上传凭证失败')
      const { uploadToken, key, uploadUrl } = tokenData
      const formData = new FormData()
      formData.append('file', file)
      formData.append('token', uploadToken)
      formData.append('key', key)
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest()
        xhr.upload.addEventListener('progress', (event) => { if (event.lengthComputable) setUploadProgress(Math.round((event.loaded / event.total) * 100)) })
        xhr.addEventListener('load', () => xhr.status === 200 ? resolve() : reject(new Error('上传失败，请重试')))
        xhr.addEventListener('error', () => reject(new Error('网络错误，请检查后重试')))
        xhr.addEventListener('timeout', () => reject(new Error('上传超时，请重试')))
        xhr.open('POST', uploadUrl)
        xhr.timeout = 300000
        xhr.send(formData)
      })
      setPdfKey(key)
      setPdfName(file.name)
      setUploadProgress(100)
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : '上传失败，请重试')
    } finally {
      setUploading(false)
    }
  }

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setError('')
    if (processingDraft) return setError('已有草稿正在生成，请完成后再提交新的申请')
    if (mode === 'SYSTEM') {
      if (!name.trim() || !gender || !idCard.trim() || !startDate || !endDate) return setError('请完整填写所有字段')
      if (!/^\d{17}[\dXx]$/.test(idCard.trim())) return setError('请输入有效的18位身份证号')
      if (startDate > endDate) return setError('实习开始日期不能晚于结束日期')
    } else if (!pdfKey) return setError('请先上传实习证明 PDF')

    setSubmitting(true)
    try {
      const body = mode === 'SYSTEM' ? { templateMode: 'SYSTEM', name, gender, idCard, startDate, endDate } : { templateMode: 'CUSTOM', pdfKey }
      const response = await fetch('/api/tools/internship-certificate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const data = await response.json() as { draft?: Draft; error?: string }
      if (!response.ok || !data.draft) {
        setError(data.error || '提交失败，请稍后重试')
        if (data.draft) setRecords((previous) => [data.draft!, ...previous.filter((record) => record.id !== data.draft!.id)])
        return
      }
      setRecords((previous) => [data.draft!, ...previous])
      setIdCard('')
      setStartDate('')
      setEndDate('')
      setPdfKey('')
      setPdfName('')
    } catch {
      setError('网络异常，请稍后重试')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        系统生成文件为“草稿 / 待审核盖章”版本，不包含公章，也不具备正式证明效力。每次提交都会保留一条申请记录。
      </div>

      {processingDraft && <div className="card flex items-center gap-4"><div className="h-8 w-8 shrink-0 animate-spin rounded-full border-4 border-indigo-200 border-t-indigo-600" /><div><h2 className="font-semibold text-gray-900">PDF 处理中</h2><p className="mt-1 text-sm text-gray-500">生成完成前暂不能提交新的申请。</p></div></div>}

      <div className={processingDraft ? 'pointer-events-none opacity-60' : ''}>
        <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <button type="button" onClick={() => setMode('SYSTEM')} className={`rounded-xl border-2 p-4 text-left ${mode === 'SYSTEM' ? 'border-indigo-500 bg-indigo-50' : 'border-gray-200 bg-white'}`}><div className="font-semibold text-gray-900">系统默认模板</div><p className="mt-1 text-xs text-gray-500">填写信息后生成带水印的 PDF 草稿</p></button>
          <button type="button" onClick={() => setMode('CUSTOM')} className={`rounded-xl border-2 p-4 text-left ${mode === 'CUSTOM' ? 'border-indigo-500 bg-indigo-50' : 'border-gray-200 bg-white'}`}><div className="font-semibold text-gray-900">自定义模板</div><p className="mt-1 text-xs text-gray-500">上传已获授权的 PDF 草稿模板</p></button>
        </div>

        <form onSubmit={submit} className="card space-y-5">
          {mode === 'SYSTEM' ? <>
            <div><label className="mb-1 block text-sm font-medium text-gray-700">姓名</label><input className="input" value={name} onChange={(event) => setName(event.target.value)} maxLength={40} required /></div>
            <div><label className="mb-2 block text-sm font-medium text-gray-700">性别</label><div className="flex gap-5">{['男', '女'].map((value) => <label key={value} className="flex items-center gap-2 text-sm text-gray-700"><input type="radio" name="certificate-gender" checked={gender === value} onChange={() => setGender(value)} required />{value}</label>)}</div></div>
            <div><label className="mb-1 block text-sm font-medium text-gray-700">身份证号</label><input className="input font-mono" value={idCard} onChange={(event) => setIdCard(event.target.value.toUpperCase())} placeholder="请输入18位身份证号" maxLength={18} required /></div>
            <div className="grid gap-5 sm:grid-cols-2"><div><label className="mb-1 block text-sm font-medium text-gray-700">实习开始日期</label><input type="date" className="input" value={startDate} onChange={(event) => setStartDate(event.target.value)} required /></div><div><label className="mb-1 block text-sm font-medium text-gray-700">实习结束日期</label><input type="date" className="input" value={endDate} onChange={(event) => setEndDate(event.target.value)} required /></div></div>
            <p className="text-sm text-gray-500">单位名称固定为：北京一生二科技有限公司；证明日期自动使用实习结束日期。</p>
          </> : <div><label className="mb-1 block text-sm font-medium text-gray-700">上传 PDF 草稿模板</label><input type="file" accept="application/pdf,.pdf" onChange={(event) => { const file = event.target.files?.[0]; if (file) uploadPdf(file) }} disabled={uploading} className="block w-full text-sm text-gray-600 file:mr-3 file:rounded-lg file:border-0 file:bg-indigo-50 file:px-4 file:py-2 file:text-indigo-700" />{uploading && <p className="mt-2 text-sm text-indigo-600">上传中… {uploadProgress}%</p>}{pdfName && !uploading && <p className="mt-2 text-sm text-green-700">已上传：{pdfName}</p>}</div>}
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button type="submit" disabled={submitting || uploading} className="w-full rounded-lg bg-indigo-600 px-5 py-3 font-medium text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60">{submitting ? '提交中…' : '提交新的草稿申请'}</button>
        </form>
      </div>

      <div className="card">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">申请记录</h2>
        {records.length === 0 ? <p className="text-sm text-gray-500">暂时没有申请记录。</p> : <div className="space-y-3">{records.map((record) => <div key={record.id} className="rounded-lg border border-gray-200 p-4"><div className="flex flex-wrap items-center justify-between gap-2"><div><span className="font-medium text-gray-900">{record.templateMode === 'SYSTEM' ? '系统模板草稿' : '自定义模板草稿'}</span><span className="ml-2 rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-700">{statusLabel(record.status)}</span></div><span className="text-xs text-gray-500">{formatDateTime(record.createdAt)}</span></div>{record.templateMode === 'SYSTEM' && record.startDate && record.endDate && <p className="mt-2 text-sm text-gray-600">实习区间：{record.startDate} 至 {record.endDate}</p>}{record.status === 'FAILED' && <p className="mt-2 text-sm text-red-600">{record.errorMsg || '生成失败，请重新提交。'}</p>}{record.status === 'REJECTED' && <p className="mt-2 text-sm text-amber-700">打回原因：{record.rejectionReason || '请联系管理员了解详情。'}</p>}{record.status === 'ISSUED' && record.downloadUrl && <a href={record.downloadUrl} download className="mt-3 inline-flex rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700">下载 PDF</a>}</div>)}</div>}
      </div>
    </div>
  )
}
