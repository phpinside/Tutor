'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { formatDateTime } from '@/lib/utils'
import { deleteCertificateTemplate, setCertificateTemplateActive } from '@/app/actions/certificateTemplate'
import { CERTIFICATE_TYPE_LABELS, type CertificateTypeKey } from '@/lib/certificate-template'

type TemplateRow = {
  id: string
  type: CertificateTypeKey
  name: string
  title: string
  companyName: string
  fieldCount: number
  isActive: boolean
  sortOrder: number
  updatedAt: string
}

export default function CertificateTemplateListClient({ initialTemplates }: { initialTemplates: TemplateRow[] }) {
  const router = useRouter()
  const [templates, setTemplates] = useState(initialTemplates)
  const [actionError, setActionError] = useState('')
  const [operatingId, setOperatingId] = useState('')

  const grouped = useMemo(() => {
    const map = new Map<CertificateTypeKey, TemplateRow[]>()
    for (const template of templates) {
      const list = map.get(template.type) ?? []
      list.push(template)
      map.set(template.type, list)
    }
    return Array.from(map.entries())
  }, [templates])

  const toggleActive = async (template: TemplateRow) => {
    setActionError('')
    setOperatingId(template.id)
    try {
      const result = await setCertificateTemplateActive(template.id, !template.isActive)
      if (!result.success) {
        setActionError(result.error || '操作失败')
        return
      }
      setTemplates((previous) => previous.map((item) => (item.id === template.id ? { ...item, isActive: !item.isActive } : item)))
    } catch {
      setActionError('网络异常，请稍后重试')
    } finally {
      setOperatingId('')
    }
  }

  const remove = async (template: TemplateRow) => {
    if (!window.confirm(`确定删除模板「${template.name}」吗？历史申请记录会保留，但不再关联此模板。`)) return
    setActionError('')
    setOperatingId(template.id)
    try {
      const result = await deleteCertificateTemplate(template.id)
      if (!result.success) {
        setActionError(result.error || '删除失败')
        return
      }
      setTemplates((previous) => previous.filter((item) => item.id !== template.id))
    } catch {
      setActionError('网络异常，请稍后重试')
    } finally {
      setOperatingId('')
    }
  }

  return (
    <div>
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">证明模板</h1>
          <p className="text-gray-600">配置各类型证明的 PDF 文案与表单字段，老师端「证明开具」实时使用激活中的模板</p>
        </div>
        <Link href="/admin/certificates/templates/new" className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700">
          + 新建模板
        </Link>
      </div>

      {actionError && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{actionError}</div>
      )}

      {templates.length === 0 ? (
        <div className="rounded-lg bg-white p-12 text-center text-gray-500 shadow">
          暂无模板，点击右上角「新建模板」创建，或运行种子脚本同步初始模板。
        </div>
      ) : (
        <div className="space-y-6">
          {grouped.map(([type, list]) => (
            <div key={type} className="rounded-lg bg-white shadow">
              <div className="border-b border-gray-200 px-4 py-3 text-sm font-semibold text-gray-900">
                {CERTIFICATE_TYPE_LABELS[type]}
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">模板名称</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">PDF 标题</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">落款单位</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">字段数</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">状态</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">更新时间</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {list.map((template) => (
                      <tr key={template.id} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="py-3 px-4 text-sm font-medium">{template.name}</td>
                        <td className="py-3 px-4 text-sm text-gray-600">{template.title}</td>
                        <td className="py-3 px-4 text-sm text-gray-600">{template.companyName}</td>
                        <td className="py-3 px-4 text-sm text-gray-600">{template.fieldCount}</td>
                        <td className="py-3 px-4 text-sm">
                          {template.isActive ? (
                            <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">启用中</span>
                          ) : (
                            <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">已停用</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-sm text-gray-600">{formatDateTime(template.updatedAt)}</td>
                        <td className="py-3 px-4 text-sm whitespace-nowrap">
                          <Link href={`/admin/certificates/templates/${template.id}`} className="text-primary-600 hover:text-primary-700 font-medium">
                            编辑
                          </Link>
                          <button
                            type="button"
                            onClick={() => toggleActive(template)}
                            disabled={operatingId === template.id}
                            className="ml-3 font-medium text-amber-600 hover:text-amber-700 disabled:opacity-50"
                          >
                            {template.isActive ? '停用' : '启用'}
                          </button>
                          <button
                            type="button"
                            onClick={() => remove(template)}
                            disabled={operatingId === template.id}
                            className="ml-3 font-medium text-red-600 hover:text-red-700 disabled:opacity-50"
                          >
                            删除
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
