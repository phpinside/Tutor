'use client'

import { useEffect, useRef, useState } from 'react'
import { CERTIFICATE_AWARDS, CERTIFICATE_GRADES, CERTIFICATE_SUBJECTS, CERTIFICATE_SIZE, defaultCertificateForm, type CertificateForm, type CertificateTemplate } from '@/lib/student-certificate-config'
import { renderCertificate } from '@/lib/student-certificate-renderer'
import type { StudentCertificateRecordDTO } from '@/lib/student-certificate-records'
import { formatDateTime } from '@/lib/utils'

type Props = { today: string; initialRecords: StudentCertificateRecordDTO[]; templates: CertificateTemplate[] }
type FieldKey = keyof CertificateForm

function TemplateThumbnail({ template, today, fontReady }: { template: CertificateTemplate; today: string; fontReady: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    if (!fontReady) return
    let alive = true
    const image = new Image()
    image.onload = () => {
      if (alive && canvasRef.current) renderCertificate(canvasRef.current, defaultCertificateForm(today), template, image, true)
    }
    image.src = template.backgroundUrl
    return () => { alive = false }
  }, [template, today, fontReady])
  return (
    <div className="flex h-28 items-center justify-center overflow-hidden rounded-md bg-gray-100">
      <div className="relative h-full max-w-full" style={{ aspectRatio: `${CERTIFICATE_SIZE[template.orientation].width}/${CERTIFICATE_SIZE[template.orientation].height}` }}>
        <canvas ref={canvasRef} role="img" aria-label={`${template.name}示例`} className="h-full w-full" />
      </div>
    </div>
  )
}

function Field({ label, value, onChange, required, maxLength, type = 'text', placeholder }: {
  label: string; value: string; onChange: (value: string) => void; required?: boolean; maxLength?: number; type?: string; placeholder?: string
}) {
  return <label className="block"><span className="mb-1.5 block text-sm font-medium text-gray-700">{label}{required && <span className="ml-1 text-red-500">*</span>}</span>
    <input className="input" type={type} value={value} onChange={event => onChange(event.target.value)} maxLength={maxLength} placeholder={placeholder} required={required} />
  </label>
}

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url; link.download = filename
  document.body.appendChild(link); link.click(); link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
}

export default function StudentCertificateClient({ today, initialRecords, templates }: Props) {
  const [form, setForm] = useState<CertificateForm>(() => defaultCertificateForm(today))
  const [templateId, setTemplateId] = useState(templates[0]?.id ?? '')
  const [background, setBackground] = useState<{ id: string; image: HTMLImageElement } | null>(null)
  const [fontReady, setFontReady] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [records, setRecords] = useState(initialRecords)
  const [largePreview, setLargePreview] = useState('')
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const savedRef = useRef('')
  const savingRef = useRef(new Set<string>())
  const template = templates.find(item => item.id === templateId) ?? templates[0]
  const customAward = !CERTIFICATE_AWARDS.some(award => award.name === form.awardName)

  useEffect(() => {
    let alive = true
    const face = new FontFace('CertificateNoto', 'url(/fonts/NotoSansCJKsc-Regular.otf)')
    face.load().then(loaded => { document.fonts.add(loaded); if (alive) setFontReady(true) })
      .catch(() => { if (alive) { setFontReady(true); setMessage('专用字体加载失败，已使用系统中文字体') } })
    return () => { alive = false }
  }, [])

  useEffect(() => {
    if (!template) return
    setBackground(null)
    const canvas = canvasRef.current
    canvas?.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height)
    let alive = true
    const image = new Image()
    image.onload = () => { if (alive) setBackground({ id: template.id, image }) }
    image.onerror = () => { if (alive) setMessage('奖状底图加载失败，请刷新页面后重试') }
    image.src = template.backgroundUrl
    return () => { alive = false }
  }, [template])

  useEffect(() => {
    if (fontReady && canvasRef.current && template && background?.id === template.id) renderCertificate(canvasRef.current, form, template, background.image)
  }, [fontReady, form, template, background])

  const setField = (key: FieldKey, value: string) => setForm(current => ({ ...current, [key]: value }))
  const selectAward = (value: string) => {
    const award = CERTIFICATE_AWARDS.find(item => item.name === value)
    setForm(current => ({ ...current, awardName: value === '__custom__' ? '' : value, citation: award?.citation ?? current.citation }))
  }
  const validate = () => {
    if (!form.studentName.trim()) throw new Error('请填写学员姓名')
    if (!form.awardName.trim()) throw new Error('请填写奖项名称')
    if (!form.issueDate) throw new Error('请选择颁发日期')
  }
  const filename = (data: CertificateForm) => [data.studentName, data.awardName, data.issueDate].map(part => part.trim().replace(/[\\/:*?"<>|\s]+/g, '').slice(0, 40)).join('_')
  const canvasBlob = (data: CertificateForm, selected: CertificateTemplate, image: HTMLImageElement) => new Promise<Blob>((resolve, reject) => {
    const canvas = canvasRef.current
    if (!canvas) return reject(new Error('奖状预览尚未准备好'))
    renderCertificate(canvas, data, selected, image)
    canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('PNG 导出失败')), 'image/png')
  })
  const saveRecord = async (blob: Blob, data: CertificateForm, selectedId: string) => {
    const signature = JSON.stringify([data, selectedId])
    if (savedRef.current === signature || savingRef.current.has(signature)) return
    savingRef.current.add(signature)
    try {
      const body = new FormData()
      body.append('image', blob, `${filename(data)}.png`)
      body.append('payload', JSON.stringify({ ...data, templateId: selectedId }))
      const response = await fetch('/api/tools/student-certificate-records', { method: 'POST', body })
      const result = await response.json().catch(() => null)
      if (!response.ok) throw new Error(result?.error || '记录保存失败')
      if (result?.record) setRecords(current => [result.record as StudentCertificateRecordDTO, ...current])
      savedRef.current = signature
    } catch (error) {
      setMessage(`奖状已导出；生成记录保存失败：${error instanceof Error ? error.message : '请稍后重试'}`)
    } finally { savingRef.current.delete(signature) }
  }
  const exportPng = async () => {
    try {
      validate(); setBusy(true); setMessage('')
      const data = { ...form }; const selected = template
      if (!selected || background?.id !== selected.id) throw new Error('奖状底图尚未加载完成')
      const blob = await canvasBlob(data, selected, background.image)
      download(blob, `${filename(data)}.png`)
      void saveRecord(blob, data, selected.id)
    } catch (error) { setMessage(error instanceof Error ? error.message : '下载失败') }
    finally { setBusy(false) }
  }
  const showLargePreview = () => {
    if (!template || background?.id !== template.id || !fontReady) return
    try {
      const canvas = document.createElement('canvas')
      renderCertificate(canvas, form, template, background.image)
      setLargePreview(canvas.toDataURL('image/png'))
    } catch { setMessage('高清大图生成失败，请稍后重试') }
  }

  if (templates.length === 0) return <div className="card text-sm text-gray-600">当前没有已启用的奖状模板，请联系管理员。</div>

  return <div className="space-y-6">
    <div className="grid gap-6 xl:grid-cols-[minmax(360px,440px)_minmax(0,1fr)]">
      <div className="space-y-5">
        <section className="card"><div className="mb-4 flex items-center justify-between"><h2 className="font-semibold text-gray-900">选择奖状模板</h2><span className="text-xs text-gray-400">A4 横版 / 竖版</span></div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-2">{templates.map(item => <button key={item.id} type="button" onClick={() => setTemplateId(item.id)} aria-pressed={item.id === templateId} className={`rounded-xl border-2 p-2 text-left transition-all ${item.id === templateId ? 'border-primary-600 bg-primary-50 shadow-sm' : 'border-gray-200 hover:border-primary-300'}`}>
            <TemplateThumbnail template={item} today={today} fontReady={fontReady} /><div className="mt-2 flex items-center justify-between gap-1 text-sm font-semibold text-gray-800"><span>{item.name}</span><span className="rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-500">{CERTIFICATE_SIZE[item.orientation].label}</span></div><div className="text-xs text-gray-500">{item.description}</div>
          </button>)}</div>
        </section>
        <section className="card space-y-4"><div className="flex items-center justify-between"><h2 className="font-semibold text-gray-900">填写奖状信息</h2><button type="button" onClick={() => { setForm(defaultCertificateForm(today)); setTemplateId(templates[0].id); setMessage('已恢复示例内容') }} className="text-sm text-primary-600 hover:text-primary-800">重置示例</button></div>
          <Field label="学员姓名" value={form.studentName} onChange={value => setField('studentName', value)} maxLength={40} required placeholder="请输入学员姓名" />
          <div className="grid grid-cols-2 gap-3"><label className="block"><span className="mb-1.5 block text-sm font-medium text-gray-700">年级</span><select className="input" value={form.grade} onChange={event => setField('grade', event.target.value)}><option value="">不显示</option>{CERTIFICATE_GRADES.map(grade => <option key={grade}>{grade}</option>)}</select></label>
            <label className="block"><span className="mb-1.5 block text-sm font-medium text-gray-700">科目</span><select className="input" value={form.subject} onChange={event => setField('subject', event.target.value)}><option value="">不显示</option>{CERTIFICATE_SUBJECTS.map(subject => <option key={subject}>{subject}</option>)}</select></label></div>
          <label className="block"><span className="mb-1.5 block text-sm font-medium text-gray-700">奖项名称 <span className="text-red-500">*</span></span><select className="input" value={customAward ? '__custom__' : form.awardName} onChange={event => selectAward(event.target.value)}>{CERTIFICATE_AWARDS.map(award => <option key={award.name} value={award.name}>{award.name}</option>)}<option value="__custom__">自定义奖项…</option></select></label>
          {customAward && <Field label="自定义奖项" value={form.awardName} onChange={value => setField('awardName', value)} maxLength={40} required placeholder="输入奖项名称" />}
          <label className="block"><span className="mb-1.5 block text-sm font-medium text-gray-700">颁奖词</span><textarea className="textarea" value={form.citation} onChange={event => setField('citation', event.target.value)} maxLength={180} rows={4} placeholder="写一段真诚的鼓励" /><span className="mt-1 block text-right text-xs text-gray-400">{form.citation.length}/180</span></label>
          <Field label="颁发单位" value={form.issuer} onChange={value => setField('issuer', value)} maxLength={80} />
          <Field label="颁发日期" type="date" value={form.issueDate} onChange={value => setField('issueDate', value)} required />
          <div className="grid grid-cols-2 gap-3"><Field label="伴学团队名称" value={form.teamName} onChange={value => setField('teamName', value)} maxLength={60} /><Field label="教练名称" value={form.coachName} onChange={value => setField('coachName', value)} maxLength={60} /></div>
        </section>
      </div>
      <div className="min-w-0"><div className="sticky top-20 space-y-4"><section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm"><div className="flex items-center justify-between border-b border-gray-100 px-5 py-4"><div><h2 className="font-semibold text-gray-900">实时预览</h2><p className="text-xs text-gray-500">{template.name} · A4 {CERTIFICATE_SIZE[template.orientation].label} · {CERTIFICATE_SIZE[template.orientation].mm}</p></div><span className="rounded-full bg-emerald-50 px-3 py-1 text-xs text-emerald-700">高清无水印</span></div>
          <div className="flex justify-center bg-slate-100 p-3 sm:p-6"><button type="button" onClick={showLargePreview} disabled={!fontReady || background?.id !== template.id} title="点击查看大图" aria-label="点击查看奖状大图" className="block cursor-zoom-in disabled:cursor-default" style={{ width: template.orientation === 'PORTRAIT' ? 'min(100%, 500px)' : '100%' }}><canvas ref={canvasRef} role="img" aria-label="奖状实时预览" className="block h-auto max-h-[72vh] w-full bg-white shadow-xl" style={{ aspectRatio: `${CERTIFICATE_SIZE[template.orientation].width}/${CERTIFICATE_SIZE[template.orientation].height}` }} /></button>{(!fontReady || background?.id !== template.id) && <p className="py-2 text-center text-sm text-gray-500">正在加载奖状预览…</p>}</div>
          <p className="border-t border-gray-100 px-5 pt-3 text-center text-xs text-gray-400">点击预览图可查看高清大图</p>
          <div className="p-4 pt-3"><button type="button" onClick={exportPng} disabled={!fontReady || background?.id !== template.id || busy} className="btn-primary w-full justify-center">下载高清 PNG 图片</button></div>
        </section>{message && <div role="status" className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">{message}</div>}<p className="text-center text-xs text-gray-500">图片尺寸 {CERTIFICATE_SIZE[template.orientation].width} × {CERTIFICATE_SIZE[template.orientation].height} 像素，无水印。</p></div></div>
    </div>
    <section className="card"><h2 className="mb-4 font-semibold text-gray-900">最近生成记录</h2>{records.length === 0 ? <p className="text-sm text-gray-500">下载图片后，生成记录会保存在这里。</p> : <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{records.slice(0, 12).map(record => <div key={record.id} className="rounded-xl border border-gray-200 p-3"><div className="flex h-44 items-center justify-center rounded bg-gray-50"><img src={record.imageUrl} alt={`${record.studentName}的${record.awardName}奖状`} className="max-h-full max-w-full object-contain" /></div><div className="mt-2 text-sm font-medium text-gray-800">{record.studentName} · {record.awardName}</div><div className="text-xs text-gray-500">{record.templateName} · {record.orientation === 'PORTRAIT' ? '竖版' : '横版'} · {formatDateTime(record.createdAt)}</div><a href={record.imageDownloadUrl} className="mt-2 inline-block text-sm text-primary-600 hover:underline">下载 PNG</a></div>)}</div>}</section>
    {largePreview && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={() => setLargePreview('')}><div className="max-h-full max-w-6xl overflow-auto rounded-xl bg-white p-4" onClick={event => event.stopPropagation()}><div className="mb-3 flex items-center justify-between gap-5 text-sm"><span>{form.studentName || '学员姓名'} · {form.awardName || '奖状'} · {template.name}</span><button type="button" onClick={() => setLargePreview('')} className="text-gray-500 hover:text-gray-900">关闭 ✕</button></div><img src={largePreview} alt="奖状高清大图" className="max-h-[78vh] w-auto max-w-full" /><a href={largePreview} download={`${filename(form)}.png`} className="btn-primary mt-4">下载 PNG</a></div></div>}
  </div>
}
