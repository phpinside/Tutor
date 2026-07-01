'use client'

import { useEffect, useMemo, useRef, useState } from 'react'

type Box = {
  x: number
  y: number
  width: number
  height: number
  radius?: number
}

type TextSlot = {
  x: number
  y: number
  maxWidth: number
  fontSize: number
  minFontSize?: number
  fontWeight?: string
  fontFamily?: string
  color?: string
  align?: CanvasTextAlign
  lineHeight?: number
  shadowColor?: string
  shadowBlur?: number
  shadowOffsetX?: number
  shadowOffsetY?: number
  strokeColor?: string
  strokeWidth?: number
}

type CaseImageTemplate = {
  id: string
  name: string
  filename: string
  url: string
  previewUrl: string
  width: number
  height: number
  screenshotBox: Box
  textSlots: Record<string, TextSlot>
}

type FormState = {
  studentRegion: string
  studentName: string
  celebrationTitle: string
  scoreTitle: string
  studyDuration: string
  scoreIncrease: string
  teamName: string
  coachSignature: string
  bottomNote: string
}

type TextFieldProps = {
  label: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  required?: boolean
  helper?: string
}

const DEFAULT_FORM: FormState = {
  studentRegion: '北京市',
  studentName: '邹小欣',
  celebrationTitle: '高考喜报',
  scoreTitle: '数学提分',
  studyDuration: '10小时',
  scoreIncrease: '19分',
  teamName: '黎沁团队',
  coachSignature: '梁树玉教练负责伴学',
  bottomNote: '',
}

const DELIVERY_CENTER = '华北交付中心'

const REQUIRED_FIELDS: Array<[keyof FormState, string]> = [
  ['studentRegion', '学生地区'],
  ['studentName', '学生姓名'],
  ['celebrationTitle', '喜报标题'],
  ['scoreTitle', '提分类目/标题'],
  ['studyDuration', '学习时长'],
  ['scoreIncrease', '提分分数'],
]

const FALLBACK_SLOT: TextSlot = {
  x: 512,
  y: 132,
  maxWidth: 840,
  fontSize: 48,
  minFontSize: 28,
  fontWeight: '800',
  color: '#fff1c7',
  align: 'center',
}

function TextField({
  label,
  value,
  onChange,
  placeholder,
  required = false,
  helper,
}: TextFieldProps) {
  return (
    <label className="block">
      <span className="mb-1.5 flex items-center gap-1 text-sm font-medium text-gray-700">
        {label}
        {required && <span className="text-red-500">*</span>}
      </span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="input"
      />
      {helper && <span className="mt-1 block text-xs text-gray-400">{helper}</span>}
    </label>
  )
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image()
    image.crossOrigin = 'anonymous'
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('图片加载失败'))
    image.src = src
  })
}

function roundedRect(ctx: CanvasRenderingContext2D, box: Box) {
  const radius = Math.min(box.radius ?? 0, box.width / 2, box.height / 2)
  ctx.beginPath()
  ctx.moveTo(box.x + radius, box.y)
  ctx.lineTo(box.x + box.width - radius, box.y)
  ctx.quadraticCurveTo(box.x + box.width, box.y, box.x + box.width, box.y + radius)
  ctx.lineTo(box.x + box.width, box.y + box.height - radius)
  ctx.quadraticCurveTo(
    box.x + box.width,
    box.y + box.height,
    box.x + box.width - radius,
    box.y + box.height
  )
  ctx.lineTo(box.x + radius, box.y + box.height)
  ctx.quadraticCurveTo(box.x, box.y + box.height, box.x, box.y + box.height - radius)
  ctx.lineTo(box.x, box.y + radius)
  ctx.quadraticCurveTo(box.x, box.y, box.x + radius, box.y)
  ctx.closePath()
}

function drawContainedImage(ctx: CanvasRenderingContext2D, image: HTMLImageElement, box: Box) {
  ctx.save()
  roundedRect(ctx, box)
  ctx.clip()
  ctx.fillStyle = '#ffd39a'
  ctx.fillRect(box.x, box.y, box.width, box.height)

  const scale = Math.min(box.width / image.naturalWidth, box.height / image.naturalHeight)
  const drawWidth = image.naturalWidth * scale
  const drawHeight = image.naturalHeight * scale
  const drawX = box.x + (box.width - drawWidth) / 2
  const drawY = box.y + (box.height - drawHeight) / 2

  ctx.drawImage(image, drawX, drawY, drawWidth, drawHeight)
  ctx.restore()
}

function buildFont(slot: TextSlot, fontSize: number) {
  const weight = slot.fontWeight ?? '700'
  const family = slot.fontFamily ?? '"PingFang SC", "Microsoft YaHei", sans-serif'
  return `${weight} ${fontSize}px ${family}`
}

function prepareText(ctx: CanvasRenderingContext2D, slot: TextSlot, fontSize: number) {
  ctx.font = buildFont(slot, fontSize)
  ctx.fillStyle = slot.color ?? '#111827'
  ctx.textAlign = slot.align ?? 'center'
  ctx.textBaseline = 'alphabetic'
  ctx.shadowColor = slot.shadowColor ?? 'transparent'
  ctx.shadowBlur = slot.shadowBlur ?? 0
  ctx.shadowOffsetX = slot.shadowOffsetX ?? 0
  ctx.shadowOffsetY = slot.shadowOffsetY ?? 0
}

function fitFontSize(ctx: CanvasRenderingContext2D, lines: string[], slot: TextSlot) {
  let fontSize = slot.fontSize
  const minFontSize = slot.minFontSize ?? Math.max(18, Math.floor(slot.fontSize * 0.58))

  while (fontSize > minFontSize) {
    ctx.font = buildFont(slot, fontSize)
    const tooWide = lines.some((line) => ctx.measureText(line).width > slot.maxWidth)
    if (!tooWide) break
    fontSize -= 2
  }

  return fontSize
}

function drawTextLines(ctx: CanvasRenderingContext2D, lines: string[], slot: TextSlot) {
  const cleanLines = lines.map((line) => line.trim()).filter(Boolean)
  if (cleanLines.length === 0) return

  ctx.save()
  const fontSize = fitFontSize(ctx, cleanLines, slot)
  const lineHeight = slot.lineHeight ?? Math.round(fontSize * 1.18)
  prepareText(ctx, slot, fontSize)

  cleanLines.forEach((line, index) => {
    const y = slot.y + index * lineHeight
    if (slot.strokeColor && slot.strokeWidth) {
      ctx.strokeStyle = slot.strokeColor
      ctx.lineWidth = slot.strokeWidth
      ctx.strokeText(line, slot.x, y)
    }
    ctx.fillText(line, slot.x, y)
  })
  ctx.restore()
}

function drawSingleText(ctx: CanvasRenderingContext2D, text: string, slot: TextSlot) {
  drawTextLines(ctx, [text], slot)
}

function drawChip(ctx: CanvasRenderingContext2D, text: string, slot: TextSlot) {
  if (!text.trim()) return

  ctx.save()
  const fontSize = fitFontSize(ctx, [text], slot)
  prepareText(ctx, slot, fontSize)
  const metrics = ctx.measureText(text)
  const paddingX = 22
  const height = Math.round(fontSize * 1.55)
  const width = Math.min(slot.maxWidth + paddingX * 2, metrics.width + paddingX * 2)
  const x = slot.x - width / 2
  const y = slot.y - height + 12

  roundedRect(ctx, { x, y, width, height, radius: height / 2 })
  ctx.fillStyle = 'rgba(255, 239, 197, 0.95)'
  ctx.fill()
  ctx.strokeStyle = 'rgba(246, 190, 98, 0.9)'
  ctx.lineWidth = 2
  ctx.stroke()

  prepareText(ctx, slot, fontSize)
  ctx.fillText(text, slot.x, slot.y)
  ctx.restore()
}

function getSlot(template: CaseImageTemplate, key: string, fallback: Partial<TextSlot> = {}) {
  return {
    ...FALLBACK_SLOT,
    ...fallback,
    ...template.textSlots[key],
  }
}

function sanitizeFilename(value: string) {
  return value.replace(/[\\/:*?"<>|]/g, '').trim() || '伴学'
}

function formatStudentDisplayName(value: string) {
  const trimmed = value.trim()
  if (!trimmed) return '同学'
  return `${trimmed[0]}同学`
}

export default function CaseImageGeneratorClient() {
  const [templates, setTemplates] = useState<CaseImageTemplate[]>([])
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null)
  const [loadingTemplates, setLoadingTemplates] = useState(true)
  const [templateError, setTemplateError] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>(DEFAULT_FORM)
  const [screenshotUrl, setScreenshotUrl] = useState<string | null>(null)
  const [screenshotName, setScreenshotName] = useState<string | null>(null)
  const [generatedUrl, setGeneratedUrl] = useState<string | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const screenshotObjectUrlRef = useRef<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const selectedTemplate = useMemo(
    () => templates.find((template) => template.id === selectedTemplateId) ?? null,
    [templates, selectedTemplateId]
  )

  useEffect(() => {
    let mounted = true

    async function loadTemplates() {
      setLoadingTemplates(true)
      setTemplateError(null)

      try {
        const response = await fetch('/api/case-image-templates')
        const data = await response.json()

        if (!response.ok) {
          throw new Error(data.error || '模板加载失败')
        }

        if (!mounted) return
        const nextTemplates: CaseImageTemplate[] = data.templates ?? []
        setTemplates(nextTemplates)
        setSelectedTemplateId(nextTemplates[0]?.id ?? null)
      } catch (error) {
        if (!mounted) return
        setTemplateError(error instanceof Error ? error.message : '模板加载失败，请刷新重试')
      } finally {
        if (mounted) setLoadingTemplates(false)
      }
    }

    loadTemplates()

    return () => {
      mounted = false
    }
  }, [])

  useEffect(() => {
    return () => {
      if (screenshotObjectUrlRef.current) {
        URL.revokeObjectURL(screenshotObjectUrlRef.current)
      }
    }
  }, [])

  const updateForm = (key: keyof FormState, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }))
    setGeneratedUrl(null)
    setFormError(null)
  }

  const selectTemplate = (templateId: string) => {
    setSelectedTemplateId(templateId)
    setGeneratedUrl(null)
    setFormError(null)
  }

  const setScreenshotFile = (file: File) => {
    if (!['image/png', 'image/jpeg', 'image/jpg', 'image/webp'].includes(file.type)) {
      setFormError('请上传 PNG、JPG 或 WEBP 格式的案例截图')
      return
    }

    if (file.size > 10 * 1024 * 1024) {
      setFormError('案例截图不能超过 10MB')
      return
    }

    if (screenshotObjectUrlRef.current) {
      URL.revokeObjectURL(screenshotObjectUrlRef.current)
    }

    const objectUrl = URL.createObjectURL(file)
    screenshotObjectUrlRef.current = objectUrl
    setScreenshotUrl(objectUrl)
    setScreenshotName(file.name)
    setGeneratedUrl(null)
    setFormError(null)
  }

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) setScreenshotFile(file)
  }

  const validate = () => {
    if (!selectedTemplate) return '请先选择一个图片模板'
    if (!screenshotUrl) return '请先上传案例截图'

    const missingField = REQUIRED_FIELDS.find(([key]) => !form[key].trim())
    if (missingField) return `请填写${missingField[1]}`

    return null
  }

  const generateImage = async () => {
    const validationError = validate()
    if (validationError) {
      setFormError(validationError)
      return
    }

    if (!selectedTemplate || !screenshotUrl) return

    setIsGenerating(true)
    setFormError(null)

    try {
      const canvas = canvasRef.current
      if (!canvas) throw new Error('Canvas 元素未找到')

      const [templateImage, screenshotImage] = await Promise.all([
        loadImage(selectedTemplate.url),
        loadImage(screenshotUrl),
      ])

      canvas.width = selectedTemplate.width
      canvas.height = selectedTemplate.height

      const ctx = canvas.getContext('2d')
      if (!ctx) throw new Error('Canvas context 获取失败')

      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.drawImage(templateImage, 0, 0, canvas.width, canvas.height)

      drawContainedImage(ctx, screenshotImage, selectedTemplate.screenshotBox)

      drawSingleText(ctx, form.celebrationTitle, getSlot(selectedTemplate, 'celebrationTitle'))
      drawSingleText(ctx, form.scoreTitle, getSlot(selectedTemplate, 'scoreTitle'))

      drawChip(ctx, DELIVERY_CENTER, getSlot(selectedTemplate, 'deliveryCenter'))

      drawTextLines(
        ctx,
        [
          `恭喜${form.studentRegion}${formatStudentDisplayName(form.studentName)}`,
          `在鼎伴学${form.studyDuration}提分${form.scoreIncrease}`,
        ],
        getSlot(selectedTemplate, 'congratulation')
      )

      drawTextLines(
        ctx,
        [form.teamName, form.coachSignature, form.bottomNote],
        getSlot(selectedTemplate, 'footer')
      )

      setGeneratedUrl(canvas.toDataURL('image/png', 1))
    } catch (error) {
      console.error('生成案例图片失败:', error)
      setFormError(error instanceof Error ? error.message : '生成失败，请重试')
    } finally {
      setIsGenerating(false)
    }
  }

  const downloadImage = () => {
    if (!generatedUrl) return

    const link = document.createElement('a')
    link.href = generatedUrl
    link.download = `案例喜报-${sanitizeFilename(formatStudentDisplayName(form.studentName))}-${Date.now()}.png`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px] gap-6">
        <div className="space-y-6">
          <div className="card">
            <h2 className="text-base font-semibold text-gray-900 mb-4">选择图片模板</h2>

            {loadingTemplates && (
              <div className="py-8 text-center text-sm text-gray-500">模板加载中...</div>
            )}

            {!loadingTemplates && templateError && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                {templateError}
              </div>
            )}

            {!loadingTemplates && !templateError && templates.length === 0 && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                还没有可用模板，请检查 public/case-image-templates/manifest.json。
              </div>
            )}

            {!loadingTemplates && templates.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {templates.map((template) => (
                  <button
                    key={template.id}
                    type="button"
                    onClick={() => selectTemplate(template.id)}
                    className={`
                      relative overflow-hidden rounded-lg border-2 bg-white text-left transition-all
                      ${selectedTemplateId === template.id
                        ? 'border-primary-600 ring-2 ring-primary-100'
                        : 'border-gray-200 hover:border-primary-300'
                      }
                    `}
                  >
                    <img
                      src={template.previewUrl}
                      alt={template.name}
                      className="w-full aspect-[2/3] object-cover"
                    />
                    <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-2 pb-2 pt-8 text-xs font-medium text-white">
                      {template.name}
                    </span>
                    {selectedTemplateId === template.id && (
                      <span className="absolute right-2 top-2 rounded-full bg-primary-600 px-2 py-0.5 text-xs font-medium text-white">
                        已选
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="card">
            <h2 className="text-base font-semibold text-gray-900 mb-4">上传案例截图</h2>
            <div
              className={`
                relative rounded-xl border-2 border-dashed p-6 text-center transition-colors
                ${screenshotUrl
                  ? 'border-primary-300 bg-primary-50'
                  : 'border-gray-200 bg-gray-50 hover:border-primary-300 hover:bg-primary-50/30'
                }
              `}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault()
                const file = event.dataTransfer.files[0]
                if (file) setScreenshotFile(file)
              }}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp"
                onChange={handleFileChange}
                className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
              />

              {screenshotUrl ? (
                <div className="flex flex-col items-center gap-3">
                  <img
                    src={screenshotUrl}
                    alt="案例截图预览"
                    className="max-h-48 max-w-full rounded-lg border border-gray-200 bg-white object-contain shadow-sm"
                  />
                  <div>
                    <p className="text-sm font-medium text-primary-700">{screenshotName}</p>
                    <p className="text-xs text-primary-500">点击或拖拽可替换截图</p>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2">
                  <span className="text-3xl text-gray-300">🖼️</span>
                  <p className="text-sm font-medium text-gray-600">点击或拖拽上传案例截图</p>
                  <p className="text-xs text-gray-400">支持 PNG/JPG/WEBP，最大 10MB</p>
                </div>
              )}
            </div>
          </div>

          <div className="card">
            <h2 className="text-base font-semibold text-gray-900 mb-4">填写生成文案</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <TextField
                label="学生地区"
                value={form.studentRegion}
                onChange={(value) => updateForm('studentRegion', value)}
                placeholder="北京市"
                required
              />
              <TextField
                label="学生姓名"
                value={form.studentName}
                onChange={(value) => updateForm('studentName', value)}
                placeholder="张小明"
                required
              />
              <TextField
                label="喜报标题"
                value={form.celebrationTitle}
                onChange={(value) => updateForm('celebrationTitle', value)}
                placeholder="高考喜报"
                required
              />
              <TextField
                label="提分类目/标题"
                value={form.scoreTitle}
                onChange={(value) => updateForm('scoreTitle', value)}
                placeholder="数学提分"
                required
              />
              <TextField
                label="学习时长"
                value={form.studyDuration}
                onChange={(value) => updateForm('studyDuration', value)}
                placeholder="10小时"
                required
              />
              <TextField
                label="提分分数"
                value={form.scoreIncrease}
                onChange={(value) => updateForm('scoreIncrease', value)}
                placeholder="19分"
                required
              />
              <TextField
                label="团队名"
                value={form.teamName}
                onChange={(value) => updateForm('teamName', value)}
                placeholder="黎沁团队"
              />
              <TextField
                label="教练署名"
                value={form.coachSignature}
                onChange={(value) => updateForm('coachSignature', value)}
                placeholder="梁树玉教练负责伴学"
              />
              <TextField
                label="底部补充文案"
                value={form.bottomNote}
                onChange={(value) => updateForm('bottomNote', value)}
                placeholder="可留空"
              />
            </div>

            {formError && (
              <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                {formError}
              </div>
            )}

            <button
              type="button"
              onClick={generateImage}
              disabled={isGenerating || loadingTemplates || templates.length === 0}
              className="mt-5 w-full rounded-lg bg-primary-600 px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isGenerating ? '正在生成...' : '确认生成案例图片'}
            </button>
          </div>
        </div>

        <aside className="space-y-4">
          <div className="card lg:sticky lg:top-24">
            <h2 className="text-base font-semibold text-gray-900 mb-4">生成预览</h2>

            {generatedUrl ? (
              <div className="space-y-4">
                <div className="rounded-lg bg-gray-50 p-2">
                  <img
                    src={generatedUrl}
                    alt="生成的案例图片"
                    className="mx-auto max-h-[560px] w-auto rounded-lg shadow-sm"
                  />
                </div>
                <button
                  type="button"
                  onClick={downloadImage}
                  className="w-full rounded-lg bg-green-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-green-700"
                >
                  下载 PNG
                </button>
                <button
                  type="button"
                  onClick={() => setGeneratedUrl(null)}
                  className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
                >
                  重新编辑
                </button>
              </div>
            ) : selectedTemplate ? (
              <div className="space-y-3">
                <div className="rounded-lg bg-gray-50 p-2">
                  <img
                    src={selectedTemplate.previewUrl}
                    alt={selectedTemplate.name}
                    className="mx-auto max-h-[420px] w-auto rounded-lg shadow-sm"
                  />
                </div>
                <p className="text-xs text-gray-500 leading-relaxed">
                  当前显示的是模板底图预览。上传截图并填写文案后，点击确认生成即可查看完整案例图。
                </p>
              </div>
            ) : (
              <div className="rounded-lg bg-gray-50 px-4 py-10 text-center text-sm text-gray-400">
                选择模板后可查看预览
              </div>
            )}
          </div>
        </aside>
      </div>

      <canvas ref={canvasRef} className="hidden" />
    </div>
  )
}
