'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createStudentCertificateTemplate, updateStudentCertificateTemplate } from '@/app/actions/studentCertificateTemplate'
import { CERTIFICATE_SIZE, CERTIFICATE_SLOT_KEYS, CERTIFICATE_SLOT_LABELS, defaultCertificateForm, defaultCertificateSlots, type CertificateOrientation, type CertificateSlotKey, type CertificateTemplate, type CertificateTextSlot } from '@/lib/student-certificate-config'
import { renderCertificate } from '@/lib/student-certificate-renderer'

type Drag = { key: CertificateSlotKey; mode: 'move' | 'resize'; x: number; y: number; slot: CertificateTextSlot }
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value))

export default function StudentCertificateTemplateEditor({ initial, today }: { initial: CertificateTemplate | null; today: string }) {
  const router = useRouter()
  const [template, setTemplate] = useState<CertificateTemplate>(initial ?? {
    id: 'new', name: '', description: '', title: '荣誉证书', orientation: 'LANDSCAPE', backgroundUrl: '',
    slots: defaultCertificateSlots('LANDSCAPE'), isActive: false, sortOrder: 0, archivedAt: null,
  })
  const [file, setFile] = useState<File | null>(null)
  const [selected, setSelected] = useState<CertificateSlotKey>('awardName')
  const [fontReady, setFontReady] = useState(false)
  const [background, setBackground] = useState<HTMLImageElement | null>(null)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [previewUrl, setPreviewUrl] = useState('')
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const frameRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<Drag | null>(null)
  const objectUrlRef = useRef('')
  const sample = defaultCertificateForm(today)

  useEffect(() => {
    let alive = true
    const face = new FontFace('CertificateNoto', 'url(/fonts/NotoSansCJKsc-Regular.otf)')
    face.load().then(loaded => { document.fonts.add(loaded); if (alive) setFontReady(true) })
      .catch(() => { if (alive) { setFontReady(true); setError('专用字体加载失败，已改用系统中文字体') } })
    return () => { alive = false; if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current) }
  }, [])
  useEffect(() => {
    setBackground(null)
    if (!template.backgroundUrl) return
    let alive = true
    const image = new Image()
    image.onload = () => { if (alive) setBackground(image) }
    image.onerror = () => { if (alive) setError('奖状底图加载失败') }
    image.src = template.backgroundUrl
    return () => { alive = false }
  }, [template.backgroundUrl])
  useEffect(() => {
    if (fontReady && background && canvasRef.current) renderCertificate(canvasRef.current, sample, template, background, true)
  }, [fontReady, background, template, today])

  const updateSlot = (key: CertificateSlotKey, patch: Partial<CertificateTextSlot>) => setTemplate(current => ({ ...current, slots: { ...current.slots, [key]: { ...current.slots[key], ...patch } } }))
  const chooseOrientation = (orientation: CertificateOrientation) => setTemplate(current => ({ ...current, orientation, backgroundUrl: '', slots: defaultCertificateSlots(orientation) }))
  const chooseImage = async (chosen: File | undefined) => {
    if (!chosen) return
    setError('')
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(chosen.type) || chosen.size > 15 * 1024 * 1024) { setError('请选择 15MB 内的 PNG、JPG 或 WebP 底图'); return }
    const url = URL.createObjectURL(chosen)
    const image = new Image()
    image.src = url
    try { await image.decode() } catch { URL.revokeObjectURL(url); setError('图片无法读取'); return }
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current)
    objectUrlRef.current = url
    setFile(chosen)
    setTemplate(current => ({ ...current, backgroundUrl: url }))
  }
  const onPointerDown = (event: React.PointerEvent<HTMLElement>, key: CertificateSlotKey, mode: Drag['mode']) => {
    event.preventDefault(); event.stopPropagation(); setSelected(key)
    event.currentTarget.setPointerCapture(event.pointerId)
    dragRef.current = { key, mode, x: event.clientX, y: event.clientY, slot: { ...template.slots[key] } }
  }
  const onPointerMove = (event: React.PointerEvent<HTMLElement>) => {
    const drag = dragRef.current
    const frame = frameRef.current
    if (!drag || !frame) return
    const rect = frame.getBoundingClientRect()
    const dx = (event.clientX - drag.x) / rect.width
    const dy = (event.clientY - drag.y) / rect.height
    if (drag.mode === 'move') updateSlot(drag.key, { x: clamp(drag.slot.x + dx, 0, 1 - drag.slot.width), y: clamp(drag.slot.y + dy, 0, 1 - drag.slot.height) })
    else updateSlot(drag.key, { width: clamp(drag.slot.width + dx, .04, 1 - drag.slot.x), height: clamp(drag.slot.height + dy, .02, 1 - drag.slot.y) })
  }
  const onPointerUp = () => { dragRef.current = null }
  const save = async () => {
    setError('')
    if (!template.name.trim()) { setError('请填写模板名称'); return }
    if (template.slots.title.visible && !template.title.trim()) { setError('请填写固定标题，或隐藏固定标题区域'); return }
    if (!template.backgroundUrl) { setError('请上传奖状底图'); return }
    setSaving(true)
    try {
      let backgroundPath: string | undefined
      if (file) {
        const form = new FormData()
        form.append('image', file); form.append('orientation', template.orientation)
        const response = await fetch('/api/admin/student-certificate-templates/upload', { method: 'POST', body: form })
        const data = await response.json().catch(() => null)
        if (!response.ok) throw new Error(data?.error || '底图上传失败')
        backgroundPath = data.path
      }
      const input = { name: template.name, description: template.description, title: template.title, orientation: template.orientation, slots: template.slots, sortOrder: template.sortOrder, backgroundPath }
      const result = initial ? await updateStudentCertificateTemplate(initial.id, input) : await createStudentCertificateTemplate(input)
      if (!result.success) throw new Error(result.error || '模板保存失败')
      router.push('/admin/student-certificate-records?tab=templates')
      router.refresh()
    } catch (cause) { setError(cause instanceof Error ? cause.message : '模板保存失败') }
    finally { setSaving(false) }
  }
  const preview = () => {
    if (!background || !fontReady) { setError('请先上传并加载底图'); return }
    try {
      const canvas = document.createElement('canvas')
      renderCertificate(canvas, sample, template, background)
      setPreviewUrl(canvas.toDataURL('image/png'))
    } catch { setError('高清预览失败，请检查底图与文字配置') }
  }
  const slot = template.slots[selected]
  const size = CERTIFICATE_SIZE[template.orientation]
  return <div className="pb-10">
    <Link href="/admin/student-certificate-records?tab=templates" className="text-sm text-gray-500 hover:text-gray-800">← 返回模板列表</Link>
    <div className="mb-6 mt-2 flex flex-wrap items-end justify-between gap-3"><div><h1 className="text-3xl font-bold">{initial ? '编辑奖状模板' : '新建奖状模板'}</h1><p className="mt-2 text-gray-600">奖项名称作为主标题，年级与科目放在中间框内。使用默认资料检查后再启用模板。</p></div><div className="flex gap-2"><button type="button" onClick={preview} disabled={!background || !fontReady} className="btn-outline">高清预览</button><button type="button" onClick={save} disabled={saving} className="btn-primary">{saving ? '保存中…' : '保存模板'}</button></div></div>
    {error && <div role="alert" className="mb-5 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
      <div className="card"><div className="mb-3 flex items-center justify-between"><h2 className="font-semibold">默认资料排版预览</h2><span className="text-xs text-gray-500">拖动文字框；拖动右下角调整宽高</span></div>
        <div className="flex min-h-96 justify-center overflow-auto rounded-xl bg-slate-100 p-4"><div ref={frameRef} className="relative h-fit max-w-full shadow-xl" style={{ width: template.orientation === 'PORTRAIT' ? 'min(100%, 520px)' : '100%', aspectRatio: `${size.width}/${size.height}` }}>
          {background && <canvas ref={canvasRef} className="block h-full w-full bg-white" />}
          {!background && <div className="flex h-full min-h-80 items-center justify-center bg-white text-sm text-gray-400">请先上传奖状底图</div>}
          {background && CERTIFICATE_SLOT_KEYS.filter(key => template.slots[key].visible).map(key => { const item = template.slots[key]; return <button key={key} type="button" onPointerDown={event => onPointerDown(event, key, 'move')} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp} className={`absolute border-2 touch-none ${selected === key ? 'border-blue-600 bg-blue-500/10' : 'border-blue-300/75 hover:border-blue-500'}`} style={{ left: `${item.x * 100}%`, top: `${item.y * 100}%`, width: `${item.width * 100}%`, height: `${item.height * 100}%` }} title={CERTIFICATE_SLOT_LABELS[key]} aria-label={`拖动${CERTIFICATE_SLOT_LABELS[key]}`}><span className="absolute -top-5 left-0 rounded bg-blue-700 px-1 text-[10px] text-white">{CERTIFICATE_SLOT_LABELS[key]}</span>{selected === key && <span onPointerDown={event => onPointerDown(event, key, 'resize')} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp} className="absolute -bottom-1.5 -right-1.5 h-4 w-4 cursor-nwse-resize rounded-sm border border-white bg-blue-600" />}</button> })}
        </div></div>
      </div>
      <div className="space-y-5"><section className="card space-y-4"><h2 className="font-semibold">模板信息</h2><label className="block text-sm">模板名称<input className="input mt-1" value={template.name} onChange={event => setTemplate(current => ({ ...current, name: event.target.value }))} maxLength={60} /></label><label className="block text-sm">模板说明<input className="input mt-1" value={template.description} onChange={event => setTemplate(current => ({ ...current, description: event.target.value }))} maxLength={120} /></label><p className="text-xs text-gray-500">主标题自动显示老师选择的奖项名称。若需要额外的固定标题，可在文字区域中启用「固定标题」。</p>{template.slots.title.visible && <label className="block text-sm">固定标题<input className="input mt-1" value={template.title} onChange={event => setTemplate(current => ({ ...current, title: event.target.value }))} maxLength={30} /></label>}<label className="block text-sm">方向<select className="input mt-1" value={template.orientation} disabled={!!initial} onChange={event => chooseOrientation(event.target.value as CertificateOrientation)}><option value="LANDSCAPE">A4 横版 · 3508 × 2480</option><option value="PORTRAIT">A4 竖版 · 2480 × 3508</option></select></label><label className="block text-sm">排序<input className="input mt-1" type="number" value={template.sortOrder} onChange={event => setTemplate(current => ({ ...current, sortOrder: Number(event.target.value) }))} /></label><label className="block text-sm">奖状底图<input className="input mt-1" type="file" accept="image/png,image/jpeg,image/webp" onChange={event => void chooseImage(event.target.files?.[0])} /><span className="mt-1 block text-xs text-gray-500">支持 PNG、JPG 或 WebP，最大 15MB；建议使用 A4 {size.label}底图，其他比例会被拉伸填满。</span></label></section>
      <section className="card space-y-3"><h2 className="font-semibold">文字区域</h2><select className="input" value={selected} onChange={event => setSelected(event.target.value as CertificateSlotKey)}>{CERTIFICATE_SLOT_KEYS.map(key => <option key={key} value={key}>{CERTIFICATE_SLOT_LABELS[key]}</option>)}</select><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={slot.visible} onChange={event => updateSlot(selected, { visible: event.target.checked })} />显示此文字</label>{selected === 'detail' && <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={slot.frame ?? false} onChange={event => updateSlot(selected, { frame: event.target.checked })} />绘制年级 / 科目边框</label>}<div className="grid grid-cols-2 gap-3"><label className="text-sm">字号<input className="input mt-1" type="number" min={12} max={120} value={slot.fontSize} onChange={event => updateSlot(selected, { fontSize: Number(event.target.value) })} /></label><label className="text-sm">文字颜色<input className="input mt-1 h-11 p-1" type="color" value={slot.color} onChange={event => updateSlot(selected, { color: event.target.value })} /></label></div><div className="grid grid-cols-2 gap-3"><label className="text-sm">对齐<select className="input mt-1" value={slot.align} onChange={event => updateSlot(selected, { align: event.target.value as CertificateTextSlot['align'] })}><option value="left">左对齐</option><option value="center">居中</option><option value="right">右对齐</option></select></label><label className="text-sm">字重<select className="input mt-1" value={slot.weight} onChange={event => updateSlot(selected, { weight: Number(event.target.value) as CertificateTextSlot['weight'] })}><option value="400">常规</option><option value="700">加粗</option></select></label></div></section></div>
    </div>
    {previewUrl && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" onClick={() => setPreviewUrl('')}><div className="max-h-full max-w-5xl overflow-auto rounded-xl bg-white p-4" onClick={event => event.stopPropagation()}><div className="mb-3 flex items-center justify-between gap-4 text-sm"><span>高清预览 · 默认学员资料 · A4 {size.label}</span><button type="button" onClick={() => setPreviewUrl('')} className="text-gray-500 hover:text-gray-900">关闭 ✕</button></div><img src={previewUrl} alt="奖状模板默认资料高清预览" className="max-h-[78vh] max-w-full object-contain" /></div></div>}
  </div>
}
