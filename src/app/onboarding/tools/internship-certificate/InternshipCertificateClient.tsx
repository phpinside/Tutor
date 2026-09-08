'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  CERTIFICATE_TYPE_LABELS,
  toChineseAmount,
  type CertificateTypeKey,
  type TemplateFieldDef,
} from '@/lib/certificate-template'

type Draft = {
  id: string
  certificateType: CertificateTypeKey
  templateId: string | null
  templateName: string | null
  name: string | null
  gender: string | null
  startDate: string | null
  endDate: string | null
  extraData: Record<string, string> | null
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

type TemplateSummary = {
  id: string
  type: CertificateTypeKey
  name: string
  title: string
  fields: TemplateFieldDef[]
  companies: { id: string | null; name: string }[]
  defaultCompanyId: string | null
}

const CERTIFICATE_TYPES: CertificateTypeKey[] = ['INTERNSHIP', 'LABOR_CONFIRMATION']

const TYPE_DESCRIPTIONS: Record<CertificateTypeKey, string> = {
  INTERNSHIP: '实习实践期间参与 AI 伴学项目的证明文件',
  LABOR_CONFIRMATION: 'AI 伴学项目劳务服务完成情况及费用确认文件',
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat('zh-CN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
}

function statusLabel(status: Draft['status']) {
  return { PROCESSING: '生成中', COMPLETED: '待审核', ISSUED: '已开具', REJECTED: '已打回', FAILED: '生成失败' }[status]
}

export default function InternshipCertificateClient({ teacherId, initialName, initialGender, initialDrafts, templates }: {
  teacherId: string
  initialName: string
  initialGender: string
  initialDrafts: Draft[]
  templates: TemplateSummary[]
}) {
  const [certType, setCertType] = useState<CertificateTypeKey | null>(null)
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateSummary | null>(null)
  const [companyId, setCompanyId] = useState<string | null>(null)
  const [customMode, setCustomMode] = useState(false)
  const [values, setValues] = useState<Record<string, string>>({})
  const [pdfKey, setPdfKey] = useState('')
  const [pdfName, setPdfName] = useState('')
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [records, setRecords] = useState<Draft[]>(initialDrafts)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const processingDraft = useMemo(() => records.find((record) => record.status === 'PROCESSING') ?? null, [records])

  const typeTemplates = useMemo(
    () => (certType ? templates.filter((template) => template.type === certType) : []),
    [templates, certType]
  )

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

  const initValues = (template: TemplateSummary) => {
    const next: Record<string, string> = {}
    for (const field of template.fields) {
      if (field.key === 'name') next.name = initialName
      if (field.key === 'gender' && (!initialGender || !field.options || field.options.includes(initialGender))) {
        next.gender = initialGender
      }
    }
    setValues(next)
  }

  const chooseTemplate = (template: TemplateSummary) => {
    setSelectedTemplate(template)
    setCustomMode(false)
    setError('')
    setCompanyId(template.defaultCompanyId)
    initValues(template)
  }

  const chooseCustom = () => {
    setSelectedTemplate(null)
    setCustomMode(true)
    setError('')
    setCompanyId(null)
    setPdfKey('')
    setPdfName('')
  }

  const backToSource = () => {
    setSelectedTemplate(null)
    setCustomMode(false)
    setError('')
    setCompanyId(null)
  }

  const backToType = () => {
    setCertType(null)
    setSelectedTemplate(null)
    setCustomMode(false)
    setError('')
    setCompanyId(null)
  }

  const setFieldValue = (key: string, value: string) => {
    setValues((previous) => ({ ...previous, [key]: value }))
  }

  const uploadPdf = async (file: File) => {
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      setError('证明文件必须为 PDF 格式')
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

  const validateForm = (): string => {
    if (!selectedTemplate) return ''
    for (const field of selectedTemplate.fields) {
      const value = (values[field.key] ?? '').trim()
      if (field.required && !value) return `请填写「${field.label}」`
      if (!value) continue
      if (field.key === 'idCard' && !/^\d{17}[\dXx]$/.test(value)) return '请输入有效的18位身份证号'
      if (field.type === 'date' && !/^\d{4}-\d{2}-\d{2}$/.test(value)) return `「${field.label}」日期格式不正确`
      if ((field.type === 'amount' || field.type === 'number') && !/^\d{1,12}(\.\d{1,2})?$/.test(value.replace(/[,\s¥￥]/g, ''))) {
        return `「${field.label}」请输入有效金额`
      }
    }
    const start = values.startDate?.trim()
    const end = values.endDate?.trim()
    if (start && end && start > end) return '开始日期不能晚于结束日期'
    return ''
  }

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setError('')
    if (processingDraft) return setError('已有草稿正在生成，请完成后再提交新的申请')
    if (!certType) return setError('请先选择证明类型')
    if (selectedTemplate) {
      const validationError = validateForm()
      if (validationError) return setError(validationError)
    } else if (customMode && !pdfKey) return setError('请先上传证明 PDF')
    else if (!selectedTemplate && !customMode) return setError('请选择系统模板或自定义上传')

    setSubmitting(true)
    try {
      const body = selectedTemplate
        ? { certificateType: certType, templateId: selectedTemplate.id, companyId, data: values }
        : { certificateType: certType, templateMode: 'CUSTOM', pdfKey }
      const response = await fetch('/api/tools/internship-certificate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const data = await response.json() as { draft?: Draft; error?: string }
      if (!response.ok || !data.draft) {
        setError(data.error || '提交失败，请稍后重试')
        if (data.draft) setRecords((previous) => [data.draft!, ...previous.filter((record) => record.id !== data.draft!.id)])
        return
      }
      setRecords((previous) => [data.draft!, ...previous])
      if (selectedTemplate) initValues(selectedTemplate)
      setPdfKey('')
      setPdfName('')
    } catch {
      setError('网络异常，请稍后重试')
    } finally {
      setSubmitting(false)
    }
  }

  const renderField = (field: TemplateFieldDef) => {
    const value = values[field.key] ?? ''
    if (field.type === 'select') {
      const options = field.options ?? []
      return (
        <div key={field.key}>
          <label className="mb-2 block text-sm font-medium text-gray-700">{field.label}{field.required && <span className="text-red-500"> *</span>}</label>
          <div className="flex gap-5">
            {options.map((option) => (
              <label key={option} className="flex items-center gap-2 text-sm text-gray-700">
                <input type="radio" name={`certificate-${field.key}`} checked={value === option} onChange={() => setFieldValue(field.key, option)} />
                {option}
              </label>
            ))}
          </div>
        </div>
      )
    }
    if (field.type === 'date') {
      return (
        <div key={field.key}>
          <label className="mb-1 block text-sm font-medium text-gray-700">{field.label}{field.required && <span className="text-red-500"> *</span>}</label>
          <input type="date" className="input" value={value} onChange={(event) => setFieldValue(field.key, event.target.value)} />
        </div>
      )
    }
    if (field.type === 'amount' || field.type === 'number') {
      const capital = field.type === 'amount' ? toChineseAmount(value) : null
      return (
        <div key={field.key}>
          <label className="mb-1 block text-sm font-medium text-gray-700">{field.label}{field.required && <span className="text-red-500"> *</span>}</label>
          <input type="number" min={0} step="0.01" className="input" value={value} onChange={(event) => setFieldValue(field.key, event.target.value)} placeholder={field.placeholder} />
          {field.type === 'amount' && capital && <p className="mt-1 text-sm text-gray-500">大写：{capital}</p>}
        </div>
      )
    }
    const isIdCard = field.key === 'idCard'
    return (
      <div key={field.key}>
        <label className="mb-1 block text-sm font-medium text-gray-700">{field.label}{field.required && <span className="text-red-500"> *</span>}</label>
        <input
          className={`input ${isIdCard ? 'font-mono' : ''}`}
          value={value}
          onChange={(event) => setFieldValue(field.key, isIdCard ? event.target.value.toUpperCase() : event.target.value)}
          placeholder={field.placeholder}
          maxLength={isIdCard ? 18 : undefined}
        />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        系统生成文件为“草稿 / 待审核盖章”版本，不包含公章，也不具备正式证明效力。每次提交都会保留一条申请记录。
      </div>

      {processingDraft && <div className="card flex items-center gap-4"><div className="h-8 w-8 shrink-0 animate-spin rounded-full border-4 border-indigo-200 border-t-indigo-600" /><div><h2 className="font-semibold text-gray-900">PDF 处理中</h2><p className="mt-1 text-sm text-gray-500">生成完成前暂不能提交新的申请。</p></div></div>}

      <div className={processingDraft ? 'pointer-events-none opacity-60' : ''}>
        {/* 第一步：选择证明类型 */}
        {!certType && (
          <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            {CERTIFICATE_TYPES.map((type) => (
              <button key={type} type="button" onClick={() => setCertType(type)} className="rounded-xl border-2 border-gray-200 bg-white p-4 text-left transition-colors hover:border-indigo-300">
                <div className="font-semibold text-gray-900">{CERTIFICATE_TYPE_LABELS[type]}</div>
                <p className="mt-1 text-xs text-gray-500">{TYPE_DESCRIPTIONS[type]}</p>
              </button>
            ))}
          </div>
        )}

        {/* 第二步：选择系统模板或自定义上传 */}
        {certType && !selectedTemplate && !customMode && (
          <>
            <button type="button" onClick={backToType} className="mb-3 text-sm text-gray-500 hover:text-gray-700">← 重新选择证明类型</button>
            <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
              {typeTemplates.map((template) => (
                <button key={template.id} type="button" onClick={() => chooseTemplate(template)} className="rounded-xl border-2 border-gray-200 bg-white p-4 text-left transition-colors hover:border-indigo-300">
                  <div className="font-semibold text-gray-900">{template.name}</div>
                  <p className="mt-1 text-xs text-gray-500">系统模板 · 填写信息后生成「{template.title}」PDF 草稿</p>
                </button>
              ))}
              <button type="button" onClick={chooseCustom} className="rounded-xl border-2 border-gray-200 bg-white p-4 text-left transition-colors hover:border-indigo-300">
                <div className="font-semibold text-gray-900">自定义模板</div>
                <p className="mt-1 text-xs text-gray-500">上传已获授权的 PDF 草稿模板</p>
              </button>
            </div>
            {typeTemplates.length === 0 && <p className="mb-4 text-sm text-gray-500">该类型暂无系统模板，可选择自定义上传。</p>}
          </>
        )}

        {/* 第三步：填写表单或上传 PDF */}
        {(selectedTemplate || customMode) && (
          <>
            <button type="button" onClick={backToSource} className="mb-3 text-sm text-gray-500 hover:text-gray-700">← 重新选择模板</button>
            <form onSubmit={submit} className="card space-y-5">
              {selectedTemplate && (
                <div className="rounded-lg bg-indigo-50 px-4 py-3 text-sm text-indigo-900">
                  {CERTIFICATE_TYPE_LABELS[certType!]} · {selectedTemplate.name}
                </div>
              )}
              {selectedTemplate ? (
                <>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">开具单位</label>
                    <select
                      className="input"
                      value={companyId ?? ''}
                      onChange={(event) => setCompanyId(event.target.value || null)}
                    >
                      {selectedTemplate.companies.map((option) => (
                        <option key={option.id ?? option.name} value={option.id ?? ''}>{option.name}</option>
                      ))}
                    </select>
                    <p className="mt-1 text-xs text-gray-500">落款与盖章将使用所选单位，默认为单位配置中的默认开具单位。</p>
                  </div>
                  {selectedTemplate.fields.map(renderField)}
                  <p className="text-sm text-gray-500">落款单位名称与日期由系统按模板生成；生成后由单位审核盖章。</p>
                </>
              ) : (
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">上传 PDF 草稿模板</label>
                  <input type="file" accept="application/pdf,.pdf" onChange={(event) => { const file = event.target.files?.[0]; if (file) uploadPdf(file) }} disabled={uploading} className="block w-full text-sm text-gray-600 file:mr-3 file:rounded-lg file:border-0 file:bg-indigo-50 file:px-4 file:py-2 file:text-indigo-700" />
                  {uploading && <p className="mt-2 text-sm text-indigo-600">上传中… {uploadProgress}%</p>}
                  {pdfName && !uploading && <p className="mt-2 text-sm text-green-700">已上传：{pdfName}</p>}
                </div>
              )}
              {error && <p className="text-sm text-red-600">{error}</p>}
              <button type="submit" disabled={submitting || uploading} className="w-full rounded-lg bg-indigo-600 px-5 py-3 font-medium text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60">{submitting ? '提交中…' : '提交新的草稿申请'}</button>
            </form>
          </>
        )}
      </div>

      <div className="card">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">申请记录</h2>
        {records.length === 0 ? <p className="text-sm text-gray-500">暂时没有申请记录。</p> : <div className="space-y-3">{records.map((record) => <div key={record.id} className="rounded-lg border border-gray-200 p-4"><div className="flex flex-wrap items-center justify-between gap-2"><div><span className="font-medium text-gray-900">{CERTIFICATE_TYPE_LABELS[record.certificateType] ?? '证明申请'} · {record.templateMode === 'SYSTEM' ? record.templateName ?? '系统模板' : '自定义上传'}</span><span className="ml-2 rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-700">{statusLabel(record.status)}</span></div><span className="text-xs text-gray-500">{formatDateTime(record.createdAt)}</span></div>{record.startDate && record.endDate && <p className="mt-2 text-sm text-gray-600">起止日期：{record.startDate} 至 {record.endDate}</p>}{record.status === 'FAILED' && <p className="mt-2 text-sm text-red-600">{record.errorMsg || '生成失败，请重新提交。'}</p>}{record.status === 'REJECTED' && <p className="mt-2 text-sm text-amber-700">打回原因：{record.rejectionReason || '请联系管理员了解详情。'}</p>}{record.status === 'ISSUED' && record.downloadUrl && <a href={record.downloadUrl} download className="mt-3 inline-flex rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700">下载 PDF</a>}</div>)}</div>}
      </div>
    </div>
  )
}
