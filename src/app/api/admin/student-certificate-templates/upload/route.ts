import { NextRequest, NextResponse } from 'next/server'
import { loadImage } from '@napi-rs/canvas'
import { isSuperAdmin } from '@/lib/admin-auth'
import { saveCertificateBackground } from '@/lib/student-certificate-template-files'
import type { CertificateOrientation } from '@/lib/student-certificate-config'

export const runtime = 'nodejs'

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
    return NextResponse.json({ path, width: image.width, height: image.height })
  } catch (error) {
    console.error('[student-certificate template upload]', error)
    if (error && typeof error === 'object' && 'code' in error && ['EROFS', 'EACCES', 'EPERM'].includes(String(error.code))) {
      return NextResponse.json({ error: '模板目录不可写，请检查 public/student-certificate-templates/ 的写入权限' }, { status: 500 })
    }
    return NextResponse.json({ error: '底图解析或上传失败' }, { status: 500 })
  }
}
