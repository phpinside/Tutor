'use client'

import { useRef, useState } from 'react'
import { formatDateTime } from '@/lib/utils'
import {
  createCertificateCompany,
  deleteCertificateCompany,
  setCertificateCompanyActive,
  updateCertificateCompany,
} from '@/app/actions/certificateCompany'

type CompanyRow = {
  id: string
  name: string
  stampKey: string | null
  stampUrl: string
  isActive: boolean
  sortOrder: number
  updatedAt: string
}

type FormState = {
  id: string | null // null = 新建
  name: string
  stampKey: string | null
  stampPreview: string // 展示用图片地址
  isActive: boolean
  sortOrder: number
}

function emptyForm(): FormState {
  return { id: null, name: '', stampKey: null, stampPreview: '/yishenger.png', isActive: true, sortOrder: 0 }
}

export default function CertificateCompanyManager({ initialCompanies }: { initialCompanies: CompanyRow[] }) {
  const [companies, setCompanies] = useState(initialCompanies)
  const [form, setForm] = useState<FormState | null>(null)
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [operatingId, setOperatingId] = useState('')
  const [error, setError] = useState('')

  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const openCreate = () => {
    setError('')
    setForm(emptyForm())
  }

  const openEdit = (company: CompanyRow) => {
    setError('')
    setForm({
      id: company.id,
      name: company.name,
      stampKey: company.stampKey,
      stampPreview: company.stampUrl,
      isActive: company.isActive,
      sortOrder: company.sortOrder,
    })
  }

  const uploadStamp = async (file: File) => {
    if (!form) return
    setError('')
    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const response = await fetch('/api/upload/certificate-stamp', { method: 'POST', body: formData })
      const data = await response.json() as { key?: string; error?: string }
      if (!response.ok || !data.key) throw new Error(data.error || '上传失败，请重试')
      setForm((previous) => previous ? { ...previous, stampKey: data.key!, stampPreview: URL.createObjectURL(file) } : previous)
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : '上传失败，请重试')
    } finally {
      setUploading(false)
    }
  }

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!form) return
    setError('')
    setSaving(true)
    const payload = { name: form.name, stampKey: form.stampKey, isActive: form.isActive, sortOrder: form.sortOrder }
    try {
      const result = form.id
        ? await updateCertificateCompany(form.id, payload)
        : await createCertificateCompany(payload)
      if (!result.success) {
        setError(result.error || '保存失败，请稍后重试')
        setSaving(false)
        return
      }
      setForm(null)
      window.location.reload()
    } catch {
      setError('网络异常，请稍后重试')
      setSaving(false)
    }
  }

  const toggleActive = async (company: CompanyRow) => {
    setError('')
    setOperatingId(company.id)
    try {
      const result = await setCertificateCompanyActive(company.id, !company.isActive)
      if (!result.success) {
        setError(result.error || '操作失败')
        return
      }
      setCompanies((previous) => previous.map((item) => (item.id === company.id ? { ...item, isActive: !item.isActive } : item)))
    } catch {
      setError('网络异常，请稍后重试')
    } finally {
      setOperatingId('')
    }
  }

  const remove = async (company: CompanyRow) => {
    if (!window.confirm(`确定删除单位「${company.name}」吗？已提交的申请记录不受影响（已快照盖章图），模板中的引用会自动失效。`)) return
    setError('')
    setOperatingId(company.id)
    try {
      const result = await deleteCertificateCompany(company.id)
      if (!result.success) {
        setError(result.error || '删除失败')
        return
      }
      setCompanies((previous) => previous.filter((item) => item.id !== company.id))
    } catch {
      setError('网络异常，请稍后重试')
    } finally {
      setOperatingId('')
    }
  }

  return (
    <div>
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">开具单位</h1>
          <p className="text-gray-600">维护落款单位名称与盖章图片，供证明模板多选配置；不上传盖章图则使用系统默认公章</p>
        </div>
        <button type="button" onClick={openCreate} className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700">
          + 新建单位
        </button>
      </div>

      {error && !form && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div>
      )}

      <div className="rounded-lg bg-white shadow overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">盖章图预览</th>
              <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">单位名称</th>
              <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">状态</th>
              <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">排序</th>
              <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">更新时间</th>
              <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">操作</th>
            </tr>
          </thead>
          <tbody>
            {companies.length === 0 ? (
              <tr><td colSpan={6} className="py-12 text-center text-gray-500">暂无单位，点击「新建单位」创建</td></tr>
            ) : companies.map((company) => (
              <tr key={company.id} className="border-b border-gray-100 hover:bg-gray-50">
                <td className="py-3 px-4">
                  <img src={company.stampUrl} alt={`${company.name} 盖章图`} className="h-16 w-16 rounded border border-gray-200 object-contain" />
                </td>
                <td className="py-3 px-4 text-sm font-medium">{company.name}</td>
                <td className="py-3 px-4 text-sm">
                  {company.isActive ? (
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">启用中</span>
                  ) : (
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">已停用</span>
                  )}
                </td>
                <td className="py-3 px-4 text-sm text-gray-600">{company.sortOrder}</td>
                <td className="py-3 px-4 text-sm text-gray-600">{formatDateTime(company.updatedAt)}</td>
                <td className="py-3 px-4 text-sm whitespace-nowrap">
                  <button type="button" onClick={() => openEdit(company)} className="text-primary-600 hover:text-primary-700 font-medium">编辑</button>
                  <button type="button" onClick={() => toggleActive(company)} disabled={operatingId === company.id} className="ml-3 font-medium text-amber-600 hover:text-amber-700 disabled:opacity-50">
                    {company.isActive ? '停用' : '启用'}
                  </button>
                  <button type="button" onClick={() => remove(company)} disabled={operatingId === company.id} className="ml-3 font-medium text-red-600 hover:text-red-700 disabled:opacity-50">删除</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {form && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[92vh] w-full max-w-lg overflow-auto rounded-xl bg-white shadow-xl">
            <form onSubmit={handleSave}>
              <div className="flex items-center justify-between border-b border-gray-200 px-5 py-3">
                <h2 className="text-base font-semibold text-gray-900">{form.id ? '编辑单位' : '新建单位'}</h2>
                <button type="button" onClick={() => setForm(null)} className="text-2xl leading-none text-gray-400 hover:text-gray-600">×</button>
              </div>
              <div className="space-y-5 p-5">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">单位名称（落款） <span className="text-red-500">*</span></label>
                  <input
                    value={form.name}
                    onChange={(event) => setForm((previous) => previous ? { ...previous, name: event.target.value } : previous)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                    placeholder="如：北京一生二科技有限公司"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">盖章图片（PNG/JPG，≤5MB）</label>
                  <div className="flex items-center gap-4">
                    <img src={form.stampPreview} alt="盖章图预览" className="h-20 w-20 rounded border border-gray-200 object-contain" />
                    <div className="space-y-2">
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/png,image/jpeg"
                        className="hidden"
                        onChange={(event) => { const file = event.target.files?.[0]; if (file) uploadStamp(file); event.target.value = '' }}
                      />
                      <button type="button" onClick={() => fileInputRef.current?.click()} disabled={uploading} className="block rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50">
                        {uploading ? '上传中…' : form.stampKey ? '重新上传' : '上传盖章图'}
                      </button>
                      {form.stampKey && (
                        <button type="button" onClick={() => setForm((previous) => previous ? { ...previous, stampKey: null, stampPreview: '/yishenger.png' } : previous)} className="block text-xs text-gray-500 hover:text-gray-700">
                          清除图片，使用系统默认公章
                        </button>
                      )}
                    </div>
                  </div>
                  {!form.stampKey && <p className="mt-1 text-xs text-gray-500">未上传时开具将使用系统默认公章（yishenger.png）。</p>}
                </div>
                <div className="grid gap-5 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">排序（越小越靠前）</label>
                    <input
                      type="number"
                      min={0}
                      value={form.sortOrder}
                      onChange={(event) => setForm((previous) => previous ? { ...previous, sortOrder: Number(event.target.value) || 0 } : previous)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                  <div className="flex items-end pb-2">
                    <label className="flex items-center gap-2 text-sm text-gray-700">
                      <input type="checkbox" checked={form.isActive} onChange={(event) => setForm((previous) => previous ? { ...previous, isActive: event.target.checked } : previous)} />
                      启用（模板与用户端可选）
                    </label>
                  </div>
                </div>
                {error && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div>}
              </div>
              <div className="flex items-center justify-end gap-3 border-t border-gray-200 px-5 py-3">
                <button type="button" onClick={() => setForm(null)} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">取消</button>
                <button type="submit" disabled={saving || uploading} className="rounded-lg bg-primary-600 px-5 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50">
                  {saving ? '保存中…' : '保存'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
