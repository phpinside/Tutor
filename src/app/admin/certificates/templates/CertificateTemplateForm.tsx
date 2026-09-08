'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  createCertificateTemplate,
  updateCertificateTemplate,
  type CertificateTemplateInput,
} from '@/app/actions/certificateTemplate'
import {
  CERTIFICATE_TYPE_LABELS,
  RESERVED_FIELD_KEYS,
  type CertificateTypeKey,
  type TemplateFieldDef,
  type TemplateFieldType,
} from '@/lib/certificate-template'

const FIELD_TYPES: { value: TemplateFieldType; label: string }[] = [
  { value: 'text', label: '文本' },
  { value: 'date', label: '日期' },
  { value: 'number', label: '数字' },
  { value: 'amount', label: '金额（自动大写）' },
  { value: 'select', label: '单选' },
]

const COMMON_PLACEHOLDERS = [
  { key: 'name', desc: '姓名（落专列）' },
  { key: 'gender', desc: '性别（落专列）' },
  { key: 'idCard', desc: '身份证号（落专列）' },
  { key: 'startDate', desc: '开始日期，格式 2026年01月02日' },
  { key: 'endDate', desc: '结束日期，同时用作落款日期' },
  { key: 'companyName', desc: '落款单位名称（系统自动填充）' },
  { key: 'amountCapital', desc: '人民币大写金额（由 amount 字段自动换算）' },
]

function emptyField(): TemplateFieldDef {
  return { key: '', label: '', type: 'text', required: true }
}

export default function CertificateTemplateForm({ templateId, initial, companies }: {
  templateId?: string
  initial?: CertificateTemplateInput
  companies: { id: string; name: string }[]
}) {
  const router = useRouter()
  const [type, setType] = useState<CertificateTypeKey>(initial?.type ?? 'INTERNSHIP')
  const [name, setName] = useState(initial?.name ?? '')
  const [title, setTitle] = useState(initial?.title ?? '')
  const [companyName, setCompanyName] = useState(initial?.companyName ?? '北京一生二科技有限公司')
  const [companyIds, setCompanyIds] = useState<string[]>(initial?.companyIds ?? [])
  const [defaultCompanyId, setDefaultCompanyId] = useState<string | null>(initial?.defaultCompanyId ?? null)
  const [bodyText, setBodyText] = useState(initial?.bodyText ?? '')
  const [fields, setFields] = useState<TemplateFieldDef[]>(initial?.fields ?? [])
  const [isActive, setIsActive] = useState(initial?.isActive ?? true)
  const [sortOrder, setSortOrder] = useState(initial?.sortOrder ?? 0)
  const [saving, setSaving] = useState(false)
  const [previewing, setPreviewing] = useState(false)
  const [error, setError] = useState('')

  const updateField = (index: number, patch: Partial<TemplateFieldDef>) => {
    setFields((previous) => previous.map((field, i) => (i === index ? { ...field, ...patch } : field)))
  }

  const toggleCompany = (id: string, checked: boolean) => {
    setCompanyIds((previous) => {
      const next = checked ? [...previous, id] : previous.filter((item) => item !== id)
      // 默认单位被取消勾选时同步清除
      if (!checked && defaultCompanyId && !next.includes(defaultCompanyId)) setDefaultCompanyId(null)
      // 第一个勾选的单位自动设为默认
      if (checked && !defaultCompanyId) setDefaultCompanyId(id)
      return next
    })
  }

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault()
    setError('')
    setSaving(true)
    const payload: CertificateTemplateInput = { type, name, title, companyName, companyIds, defaultCompanyId, bodyText, fields, isActive, sortOrder }
    try {
      const result = templateId
        ? await updateCertificateTemplate(templateId, payload)
        : await createCertificateTemplate(payload)
      if (!result.success) {
        setError(result.error || '保存失败，请稍后重试')
        setSaving(false)
        return
      }
      router.push('/admin/certificates/templates')
      router.refresh()
    } catch {
      setError('网络异常，请稍后重试')
      setSaving(false)
    }
  }

  const handlePreview = async () => {
    setError('')
    setPreviewing(true)
    try {
      const response = await fetch('/api/admin/certificate-templates/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, title, companyName, bodyText, fields }),
      })
      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        setError(data.error || '预览生成失败')
        return
      }
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      window.open(url, '_blank')
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
    } catch {
      setError('网络异常，预览失败')
    } finally {
      setPreviewing(false)
    }
  }

  // 公共占位符与自定义字段可能同名（如模板定义了 name 字段），按 key 去重避免渲染重复
  const availablePlaceholders = (() => {
    const seen = new Set<string>()
    const result: { key: string; desc: string }[] = []
    for (const item of [
      ...COMMON_PLACEHOLDERS,
      ...fields.filter((field) => field.key).map((field) => ({ key: field.key, desc: field.label })),
    ]) {
      if (seen.has(item.key)) continue
      seen.add(item.key)
      result.push(item)
    }
    return result
  })()

  return (
    <div>
      <div className="mb-8">
        <Link href="/admin/certificates/templates" className="text-sm text-gray-500 hover:text-gray-700">← 返回模板列表</Link>
        <h1 className="mt-2 text-3xl font-bold text-gray-900 mb-2">{templateId ? '编辑模板' : '新建模板'}</h1>
        <p className="text-gray-600">正文支持 <code className="rounded bg-gray-100 px-1">{'{{字段}}'}</code> 占位符，空行分段；保存后老师端实时生效。</p>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        <div className="rounded-lg bg-white p-6 shadow space-y-5">
          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">证明类型 <span className="text-red-500">*</span></label>
              <select value={type} onChange={(event) => setType(event.target.value as CertificateTypeKey)} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500">
                {(Object.keys(CERTIFICATE_TYPE_LABELS) as CertificateTypeKey[]).map((key) => (
                  <option key={key} value={key}>{CERTIFICATE_TYPE_LABELS[key]}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">模板名称（同类型内唯一） <span className="text-red-500">*</span></label>
              <input value={name} onChange={(event) => setName(event.target.value)} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500" placeholder="如：实习实践证明（标准版）" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">PDF 大标题 <span className="text-red-500">*</span></label>
              <input value={title} onChange={(event) => setTitle(event.target.value)} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500" placeholder="如：实习实践证明" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">兜底落款单位名称</label>
              <input value={companyName} onChange={(event) => setCompanyName(event.target.value)} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500" />
              <p className="mt-1 text-xs text-gray-500">仅在下方未勾选任何可选单位时使用；同时作为系统默认公章的落款。</p>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">排序（越小越靠前）</label>
              <input type="number" min={0} value={sortOrder} onChange={(event) => setSortOrder(Number(event.target.value) || 0)} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500" />
            </div>
            <div className="flex items-end pb-2">
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input type="checkbox" checked={isActive} onChange={(event) => setIsActive(event.target.checked)} />
                启用（老师端可见）
              </label>
            </div>
          </div>

          <div className="rounded-lg border border-gray-200 p-4">
            <h3 className="mb-1 text-sm font-semibold text-gray-900">可选落款单位（可多选）</h3>
            <p className="mb-3 text-xs text-gray-500">勾选后用户申请时可自选单位并加盖对应盖章图；默认单位排最前且预选中。全部不勾 = 仅使用上方兜底落款 + 系统默认公章。单位在「开具单位」页面维护。</p>
            {companies.length === 0 ? (
              <p className="text-sm text-gray-500">暂无可用单位，请先到「开具单位」页面创建。</p>
            ) : (
              <>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {companies.map((company) => (
                    <label key={company.id} className="flex items-center gap-2 rounded border border-gray-200 px-3 py-2 text-sm text-gray-700">
                      <input type="checkbox" checked={companyIds.includes(company.id)} onChange={(event) => toggleCompany(company.id, event.target.checked)} />
                      <span className="truncate">{company.name}</span>
                    </label>
                  ))}
                </div>
                {companyIds.length > 1 && (
                  <div className="mt-3">
                    <label className="mb-1 block text-sm font-medium text-gray-700">默认单位</label>
                    <select
                      value={defaultCompanyId ?? ''}
                      onChange={(event) => setDefaultCompanyId(event.target.value || null)}
                      className="w-full max-w-sm px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                    >
                      {companyIds.map((id) => (
                        <option key={id} value={id}>{companies.find((company) => company.id === id)?.name ?? id}</option>
                      ))}
                    </select>
                  </div>
                )}
              </>
            )}
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">正文内容 <span className="text-red-500">*</span></label>
            <textarea
              value={bodyText}
              onChange={(event) => setBodyText(event.target.value)}
              rows={16}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg font-mono text-sm leading-relaxed focus:ring-2 focus:ring-primary-500"
              placeholder={'兹证明 {{name}}，性别：{{gender}}，身份证号：{{idCard}}。\n\n该人员于{{startDate}}至{{endDate}}期间……\n\n特此证明。'}
            />
            <p className="mt-1 text-xs text-gray-500">空行分段；单换行为普通换行。落款块（单位名称 / （单位公章） / 日期）由系统固定生成，无需写在正文中。</p>
          </div>
        </div>

        <div className="rounded-lg bg-white p-6 shadow">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-base font-semibold text-gray-900">表单字段定义</h2>
            <button type="button" onClick={() => setFields((previous) => [...previous, emptyField()])} className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50">
              + 添加字段
            </button>
          </div>
          <p className="mb-4 text-xs text-gray-500">key 为占位符名（也用于落库），<code className="rounded bg-gray-100 px-1">name / gender / idCard / startDate / endDate</code> 自动存入专列，其余存入扩展数据。金额类型自动生成大写 <code className="rounded bg-gray-100 px-1">{'{{amountCapital}}'}</code>。</p>
          {fields.length === 0 ? (
            <p className="text-sm text-gray-500">暂无字段，点击「添加字段」创建。没有字段时老师端无法使用该系统模板填写信息，只能通过自定义上传方式提交。</p>
          ) : (
            <div className="space-y-3">
              {fields.map((field, index) => (
                <div key={index} className="grid items-start gap-3 rounded-lg border border-gray-200 p-3 sm:grid-cols-12">
                  <input
                    value={field.key}
                    onChange={(event) => updateField(index, { key: event.target.value })}
                    placeholder="key（如 amount）"
                    className="sm:col-span-3 px-3 py-2 border border-gray-300 rounded-lg font-mono text-sm"
                  />
                  <input
                    value={field.label}
                    onChange={(event) => updateField(index, { label: event.target.value })}
                    placeholder="显示名称"
                    className="sm:col-span-3 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                  <select
                    value={field.type}
                    onChange={(event) => updateField(index, { type: event.target.value as TemplateFieldType })}
                    className="sm:col-span-2 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  >
                    {FIELD_TYPES.map((item) => (
                      <option key={item.value} value={item.value}>{item.label}</option>
                    ))}
                  </select>
                  <input
                    value={field.placeholder ?? ''}
                    onChange={(event) => updateField(index, { placeholder: event.target.value })}
                    placeholder="占位提示（选填）"
                    className="sm:col-span-2 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                  <label className="sm:col-span-1 flex items-center gap-1 text-xs text-gray-700">
                    <input type="checkbox" checked={field.required === true} onChange={(event) => updateField(index, { required: event.target.checked })} />
                    必填
                  </label>
                  <button type="button" onClick={() => setFields((previous) => previous.filter((_, i) => i !== index))} className="sm:col-span-1 text-sm font-medium text-red-600 hover:text-red-700">
                    删除
                  </button>
                  {field.type === 'select' && (
                    <input
                      value={(field.options ?? []).join('，')}
                      onChange={(event) => updateField(index, { options: event.target.value.split(/[,，]/).map((option) => option.trim()).filter(Boolean) })}
                      placeholder="选项，用逗号分隔（如：男，女）"
                      className="sm:col-span-12 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    />
                  )}
                  {field.key && RESERVED_FIELD_KEYS.includes(field.key) && (
                    <p className="sm:col-span-12 text-xs text-red-600">key「{field.key}」为系统保留占位符，请更换。</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-lg bg-white p-6 shadow">
          <h2 className="mb-3 text-base font-semibold text-gray-900">可用占位符</h2>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {availablePlaceholders.map((item) => (
              <div key={item.key} className="rounded border border-gray-200 px-3 py-2 text-sm">
                <code className="rounded bg-gray-100 px-1">{'{{'}{item.key}{'}}'}</code>
                <span className="ml-2 text-xs text-gray-500">{item.desc}</span>
              </div>
            ))}
          </div>
        </div>

        {error && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div>}

        <div className="flex items-center justify-end gap-3">
          <button type="button" onClick={handlePreview} disabled={previewing || saving} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50">
            {previewing ? '生成预览中…' : '预览 PDF（示例数据）'}
          </button>
          <button type="submit" disabled={saving || previewing} className="rounded-lg bg-primary-600 px-5 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50">
            {saving ? '保存中…' : '保存模板'}
          </button>
        </div>
      </form>
    </div>
  )
}
