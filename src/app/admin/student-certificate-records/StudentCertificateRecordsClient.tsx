'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { formatDateTime } from '@/lib/utils'
import { archiveStudentCertificateTemplate, restoreStudentCertificateTemplate, setStudentCertificateTemplateActive } from '@/app/actions/studentCertificateTemplate'
import { CERTIFICATE_SIZE, type CertificateTemplate } from '@/lib/student-certificate-config'
import type { StudentCertificateRecordDTO } from '@/lib/student-certificate-records'

type Tab = 'records' | 'templates'

export default function StudentCertificateRecordsClient({ initialRecords, initialTemplates, initialTab }: {
  initialRecords: StudentCertificateRecordDTO[]
  initialTemplates: CertificateTemplate[]
  initialTab: Tab
}) {
  const [tab, setTab] = useState<Tab>(initialTab)
  const tabClass = (active: boolean) => `rounded-lg px-4 py-2 text-sm font-medium transition-colors ${active ? 'bg-primary-600 text-white shadow-sm' : 'border border-gray-200 bg-white text-gray-600 hover:bg-gray-50'}`
  return <div>
    <div className="mb-7"><h1 className="mb-3 text-3xl font-bold text-gray-900">学员奖状管理</h1><div className="flex gap-2"><button type="button" onClick={() => setTab('records')} className={tabClass(tab === 'records')}>生成记录 ({initialRecords.length})</button><button type="button" onClick={() => setTab('templates')} className={tabClass(tab === 'templates')}>模板管理 ({initialTemplates.length})</button></div></div>
    <div className={tab === 'records' ? '' : 'hidden'}><RecordsPanel records={initialRecords} /></div>
    <div className={tab === 'templates' ? '' : 'hidden'}><TemplatesPanel initialTemplates={initialTemplates} /></div>
  </div>
}

function RecordsPanel({ records }: { records: StudentCertificateRecordDTO[] }) {
  const [search, setSearch] = useState('')
  const [preview, setPreview] = useState<StudentCertificateRecordDTO | null>(null)
  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return records
    return records.filter(record => [record.studentName, record.awardName, record.templateName, record.teamName, record.coachName, record.teacherName, record.teacherPhone].some(value => value?.toLowerCase().includes(term)))
  }, [records, search])
  return <div>
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm"><div className="border-b border-gray-200 p-4"><input className="input max-w-xl" value={search} onChange={event => setSearch(event.target.value)} placeholder="搜索学员、奖项、模板、团队、教练或老师" /></div>
      {filtered.length === 0 ? <div className="px-4 py-16 text-center text-sm text-gray-400">暂无符合条件的记录</div> : <div className="overflow-x-auto"><table className="min-w-full divide-y divide-gray-200 text-sm"><thead className="bg-gray-50 text-left text-xs text-gray-500"><tr>{['生成时间', '生成人', '学员', '年级 / 科目', '奖项', '模板', '团队 / 教练', '操作'].map(label => <th key={label} className="whitespace-nowrap px-4 py-3 font-medium">{label}</th>)}</tr></thead><tbody className="divide-y divide-gray-100">{filtered.map(record => <tr key={record.id} className="hover:bg-gray-50"><td className="whitespace-nowrap px-4 py-3">{formatDateTime(record.createdAt)}</td><td className="whitespace-nowrap px-4 py-3">{record.teacherName || '-'}<div className="text-xs text-gray-400">{record.teacherPhone || ''}</div></td><td className="whitespace-nowrap px-4 py-3 font-medium">{record.studentName}</td><td className="whitespace-nowrap px-4 py-3">{[record.grade, record.subject].filter(Boolean).join(' / ') || '-'}</td><td className="whitespace-nowrap px-4 py-3">{record.awardName}</td><td className="whitespace-nowrap px-4 py-3">{record.templateName} · {record.orientation === 'PORTRAIT' ? '竖版' : '横版'}</td><td className="whitespace-nowrap px-4 py-3">{record.teamName || '-'}<div className="text-xs text-gray-400">{record.coachName || ''}</div></td><td className="whitespace-nowrap px-4 py-3"><button type="button" onClick={() => setPreview(record)} className="mr-3 text-primary-600 hover:underline">预览</button><a href={record.imageDownloadUrl} className="text-green-700 hover:underline">下载</a></td></tr>)}</tbody></table></div>}
    </div>
    {preview && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={() => setPreview(null)}><div className="max-h-full max-w-5xl overflow-auto rounded-xl bg-white p-4" onClick={event => event.stopPropagation()}><div className="mb-3 flex items-center justify-between gap-5 text-sm"><span>{preview.studentName} · {preview.awardName} · {preview.templateName}</span><button type="button" onClick={() => setPreview(null)} className="text-gray-500 hover:text-gray-900">关闭 ✕</button></div><img src={preview.imageUrl} alt={`${preview.studentName}的奖状`} className="max-h-[75vh] w-auto max-w-full" /><a href={preview.imageDownloadUrl} className="btn-primary mt-4">下载 PNG</a></div></div>}
  </div>
}

function TemplatesPanel({ initialTemplates }: { initialTemplates: CertificateTemplate[] }) {
  const router = useRouter()
  const [templates, setTemplates] = useState(initialTemplates)
  const [busyId, setBusyId] = useState('')
  const [error, setError] = useState('')
  useEffect(() => { setTemplates(initialTemplates) }, [initialTemplates])
  const change = async (template: CertificateTemplate, action: 'toggle' | 'archive' | 'restore') => {
    if (action === 'archive' && !window.confirm(`归档「${template.name}」？老师端将不再显示，历史奖状保留。`)) return
    setBusyId(template.id); setError('')
    try {
      const result = action === 'toggle'
        ? await setStudentCertificateTemplateActive(template.id, !template.isActive)
        : action === 'archive' ? await archiveStudentCertificateTemplate(template.id) : await restoreStudentCertificateTemplate(template.id)
      if (!result.success) { setError(result.error || '操作失败'); return }
      setTemplates(current => current.map(item => item.id !== template.id ? item : {
        ...item, isActive: action === 'toggle' ? !item.isActive : false,
        archivedAt: action === 'archive' ? new Date().toISOString() : action === 'restore' ? null : item.archivedAt,
      }))
      router.refresh()
    } catch { setError('操作失败，请稍后重试') }
    finally { setBusyId('') }
  }
  return <div>
    {error && <div role="alert" className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><p className="text-sm text-gray-600">上传横版或竖版底图，调整文字位置，使用默认数据预览后手动启用。</p><Link href="/admin/student-certificate-records/templates/new" className="btn-primary">+ 新建模板</Link></div>
    <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">{templates.map(template => <div key={template.id} className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="flex h-56 items-center justify-center bg-slate-100 p-4"><img src={template.backgroundUrl} alt={`${template.name}底图`} className="max-h-full max-w-full object-contain shadow" /></div>
      <div className="space-y-3 p-4"><div className="flex items-start justify-between gap-2"><div><h2 className="font-semibold text-gray-900">{template.name}</h2><p className="text-xs text-gray-500">{template.description || '暂无说明'}</p></div><span className="whitespace-nowrap rounded bg-gray-100 px-2 py-1 text-xs text-gray-600">{CERTIFICATE_SIZE[template.orientation].label}</span></div>
      <div className="flex gap-2 text-xs"><span className={`rounded-full px-2 py-1 ${template.archivedAt ? 'bg-gray-100 text-gray-500' : template.isActive ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>{template.archivedAt ? '已归档' : template.isActive ? '已启用' : '待检查 / 已停用'}</span><span className="rounded-full bg-gray-100 px-2 py-1 text-gray-500">排序 {template.sortOrder}</span></div>
      <div className="flex flex-wrap gap-3 border-t border-gray-100 pt-3 text-sm"><Link href={`/admin/student-certificate-records/templates/${template.id}`} className="text-primary-600 hover:underline">编辑 / 预览</Link>{template.archivedAt ? <button type="button" disabled={busyId === template.id} onClick={() => change(template, 'restore')} className="text-green-700 disabled:opacity-50">恢复</button> : <><button type="button" disabled={busyId === template.id} onClick={() => change(template, 'toggle')} className="text-amber-700 disabled:opacity-50">{template.isActive ? '停用' : '启用'}</button><button type="button" disabled={busyId === template.id} onClick={() => change(template, 'archive')} className="text-red-600 disabled:opacity-50">归档</button></>}</div>
      </div></div>)}</div>
  </div>
}
