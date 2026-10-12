import { NextRequest, NextResponse } from 'next/server'
import { createCanvas, loadImage } from '@napi-rs/canvas'
import { isSuperAdmin } from '@/lib/admin-auth'
import { certificateThumbnailPathFor, saveCertificateBackground, saveCertificateThumbnail } from '@/lib/student-certificate-template-files'
import type { CertificateOrientation } from '@/lib/student-certificate-config'

export const runtime = 'nodejs'

const THUMBNAIL_MAX_EDGE = 480

export async function POST(request: NextRequest) {
  if (!(await isSuperAdmin())) return NextResponse.json({ error: '仅管理员可上传奖状底图' }, { status: 403 })
  try {
    const body = await request.formData()
    const file = body.get('image')
    const orientation = body.get('orientation') as CertificateOrientation
    if (!(file instanceof File) || !['LANDSCAPE', 'PORTRAIT'].includes(orientation)) return NextResponse.json({ error: '请选择底图和方向' }, { status: 400 })
    const extensions: Record<string, 'png' | 'jpg' | 'webp'> = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' }
    const ext = extensions[file.type]
    if (!ext || file.size < 100 || file.size > 15 * 1024 * 1024) return NextResponse.json({ error: '仅支持 15MB 内的 PNG、JPG 或 WebP 图片' }, { status: 400 })
    const buffer = Buffer.from(await file.arrayBuffer())
    const image = await loadImage(buffer)
    const path = await saveCertificateBackground(buffer, ext)
    // 同步生成模板列表小图；失败不阻断上传，前端回退原图
    const thumbnailPath = certificateThumbnailPathFor(path)
    if (thumbnailPath) {
      try {
        const scale = Math.min(1, THUMBNAIL_MAX_EDGE / Math.max(image.width, image.height))
        const canvas = createCanvas(Math.max(1, Math.round(image.width * scale)), Math.max(1, Math.round(image.height * scale)))
        const ctx = canvas.getContext('2d')
        ctx.fillStyle = '#ffffff'
        ctx.fillRect(0, 0, canvas.width, canvas.height)
        ctx.drawImage(image, 0, 0, canvas.width, canvas.height)
        await saveCertificateThumbnail(canvas.toBuffer('image/jpeg', 80), thumbnailPath)
      } catch (thumbnailError) {
        console.error('[student-certificate template thumbnail]', thumbnailError)
      }
    }
    return NextResponse.json({ path, thumbnailPath, width: image.width, height: image.height })
  } catch (error) {
    console.error('[student-certificate template upload]', error)
    if (error && typeof error === 'object' && 'code' in error && ['EROFS', 'EACCES', 'EPERM'].includes(String(error.code))) {
      return NextResponse.json({ error: '模板目录不可写，请检查 public/student-certificate-templates/ 的写入权限' }, { status: 500 })
    }
    return NextResponse.json({ error: '底图解析或上传失败' }, { status: 500 })
  }
}
