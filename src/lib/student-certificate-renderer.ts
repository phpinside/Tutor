import { CERTIFICATE_SIZE, CERTIFICATE_SLOT_KEYS, type CertificateForm, type CertificateSlotKey, type CertificateTemplate, type CertificateTextSlot } from './student-certificate-config'

const FONT = 'CertificateNoto, "Noto Sans CJK SC", "PingFang SC", sans-serif'

function slotValue(key: CertificateSlotKey, form: CertificateForm, template: CertificateTemplate): string {
  switch (key) {
    case 'title': return template.title
    case 'studentName': return form.studentName.trim() || '学员姓名'
    case 'detail': return [form.grade.trim().replace(/^小学/, ''), form.subject.trim()].filter(Boolean).join(' · ')
    case 'awardLabel': return '将此荣誉证书颁发给'
    case 'awardName': return form.awardName.trim() || '奖项名称'
    case 'citation': return form.citation.trim()
    case 'teamName': return form.teamName.trim()
    case 'coachName': return form.coachName.trim() ? `指导教练：${form.coachName.trim()}` : ''
    case 'issuer': return form.issuer.trim()
    case 'issueDate': return form.issueDate.replace(/^(\d{4})-(\d{2})-(\d{2})$/, '$1年$2月$3日')
  }
}

function wrap(ctx: CanvasRenderingContext2D, value: string, width: number): string[] {
  const lines: string[] = []
  let current = ''
  for (const char of value.replace(/\s+/g, ' ').trim()) {
    if (current && ctx.measureText(current + char).width > width) {
      if ('，。！？；：、）】》'.includes(char)) { current += char; continue }
      lines.push(current); current = char
    }
    else current += char
  }
  if (current) lines.push(current)
  return lines
}

function drawText(ctx: CanvasRenderingContext2D, value: string, slot: CertificateTextSlot, pageWidth: number, pageHeight: number, offsetY = 0) {
  if (!slot.visible || !value) return
  const x = slot.x * pageWidth
  const y = (slot.y + offsetY) * pageHeight
  const width = slot.width * pageWidth
  const height = slot.height * pageHeight
  if (slot.frame) {
    ctx.save()
    ctx.fillStyle = '#fff8e9'
    ctx.strokeStyle = '#c59a4b'
    ctx.lineWidth = 1.2
    ctx.beginPath()
    ctx.roundRect(x + 1, y + 1, width - 2, height - 2, 8)
    ctx.fill()
    ctx.stroke()
    ctx.globalAlpha = .6
    ctx.beginPath()
    ctx.roundRect(x + 5, y + 5, width - 10, height - 10, 5)
    ctx.stroke()
    ctx.restore()
  }
  let size = slot.fontSize
  let lines: string[] = []
  const maxLines = height > size * 2.5 ? 8 : height > size * 1.5 ? 2 : 1
  while (size >= 12) {
    ctx.font = `${slot.weight} ${size}px ${FONT}`
    lines = maxLines === 1 ? [value] : wrap(ctx, value, width)
    const widest = Math.max(0, ...lines.map(line => ctx.measureText(line).width))
    const neededHeight = lines.length === 1 ? size : lines.length * size * 1.35
    if (widest <= width && lines.length <= maxLines && neededHeight <= height) break
    size -= 1
  }
  ctx.font = `${slot.weight} ${size}px ${FONT}`
  if (maxLines === 1 && ctx.measureText(value).width > width) lines = wrap(ctx, value, width)
  ctx.fillStyle = slot.color
  ctx.textAlign = slot.align
  ctx.textBaseline = 'middle'
  const textX = slot.align === 'left' ? x : slot.align === 'right' ? x + width : x + width / 2
  const lineHeight = Math.min(size * 1.42, height / Math.max(1, lines.length))
  const firstY = y + (height - lineHeight * lines.length) / 2 + lineHeight / 2
  lines.forEach((line, index) => ctx.fillText(line, textX, firstY + index * lineHeight, width))
}

/** The editor, teacher preview, and PNG export all use this renderer. */
export function renderCertificate(
  canvas: HTMLCanvasElement,
  form: CertificateForm,
  template: CertificateTemplate,
  background: CanvasImageSource,
  preview = false,
) {
  const size = CERTIFICATE_SIZE[template.orientation]
  const logicalWidth = template.orientation === 'LANDSCAPE' ? 1200 : 848
  const logicalHeight = logicalWidth * size.height / size.width
  const outputWidth = preview ? logicalWidth : size.width
  const outputHeight = preview ? Math.round(logicalHeight) : size.height
  canvas.width = outputWidth
  canvas.height = outputHeight
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('浏览器无法创建绘图画布')
  ctx.drawImage(background, 0, 0, outputWidth, outputHeight)
  ctx.scale(outputWidth / logicalWidth, outputHeight / logicalHeight)
  const hasDetail = Boolean(form.grade.trim() || form.subject.trim())
  for (const key of CERTIFICATE_SLOT_KEYS) {
    const slot = template.slots[key]
    if (!slot) continue
    // Printed plaques stay fixed; an optional drawn frame disappears with empty details.
    const offset = !hasDetail && template.slots.detail.frame && key === 'citation' ? -template.slots.detail.height : 0
    drawText(ctx, slotValue(key, form, template), slot, logicalWidth, logicalHeight, offset)
  }
}
