import fs from 'fs'
import path from 'path'
import { NextResponse } from 'next/server'

type Box = {
  x: number
  y: number
  width: number
  height: number
  radius?: number
}

type ManifestTemplate = {
  id: string
  name: string
  filename: string
  previewFilename?: string
  baseTemplateId?: string
  width: number
  height: number
  layout?: 'portrait' | 'landscape'
  screenshotBox: Box
  textSlots: Record<string, unknown>
}

function isNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function isBox(value: unknown): value is Box {
  if (!value || typeof value !== 'object') return false
  const box = value as Partial<Box>
  return isNumber(box.x) && isNumber(box.y) && isNumber(box.width) && isNumber(box.height)
}

function isManifestTemplate(value: unknown): value is ManifestTemplate {
  if (!value || typeof value !== 'object') return false
  const template = value as Partial<ManifestTemplate>

  return (
    typeof template.id === 'string' &&
    typeof template.name === 'string' &&
    typeof template.filename === 'string' &&
    isNumber(template.width) &&
    isNumber(template.height) &&
    isBox(template.screenshotBox) &&
    !!template.textSlots &&
    typeof template.textSlots === 'object'
  )
}

function publicTemplateUrl(filename: string) {
  return `/case-image-templates/${encodeURIComponent(path.basename(filename))}`
}

export async function GET() {
  try {
    const templatesDir = path.join(process.cwd(), 'public/case-image-templates')
    const manifestPath = path.join(templatesDir, 'manifest.json')

    if (!fs.existsSync(manifestPath)) {
      return NextResponse.json({ templates: [] })
    }

    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as { templates?: unknown[] }
    const validTemplates = (manifest.templates ?? [])
      .filter(isManifestTemplate)
      .filter((template) => fs.existsSync(path.join(templatesDir, path.basename(template.filename))))
    const templatesById = new Map(validTemplates.map((template) => [template.id, template]))

    const templates = validTemplates
      .map((template) => {
        const previewFilename = template.previewFilename ?? template.filename
        const baseTemplate = template.baseTemplateId
          ? templatesById.get(template.baseTemplateId)
          : undefined

        return {
          ...template,
          textSlots: {
            ...(baseTemplate?.textSlots ?? {}),
            ...template.textSlots,
          },
          filename: path.basename(template.filename),
          previewFilename: path.basename(previewFilename),
          url: publicTemplateUrl(template.filename),
          previewUrl: publicTemplateUrl(previewFilename),
        }
      })

    return NextResponse.json({ templates })
  } catch (error) {
    console.error('读取案例图片模板失败:', error)
    return NextResponse.json({ templates: [], error: '模板读取失败' }, { status: 500 })
  }
}
