import { NextRequest, NextResponse } from 'next/server'
import { uploadToQiniu, generateCertificateStampKey } from '@/lib/qiniu'
import { isSuperAdmin } from '@/lib/admin-auth'

/** 管理员上传开具单位盖章图片（服务端中转上传七牛），返回存储 key。 */
export async function POST(request: NextRequest) {
  if (!(await isSuperAdmin())) {
    return NextResponse.json({ error: '仅超级管理员可上传盖章图片' }, { status: 403 })
  }

  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null
    if (!file) {
      return NextResponse.json({ error: '请选择要上传的图片' }, { status: 400 })
    }

    // pdf-lib 嵌入仅支持 PNG/JPG
    const isValidType = file.type === 'image/png' || file.type === 'image/jpeg'
    const isValidExt = /\.(png|jpe?g)$/i.test(file.name)
    if (!isValidType && !isValidExt) {
      return NextResponse.json({ error: '盖章图片仅支持 PNG、JPG 格式' }, { status: 400 })
    }

    const maxSize = 5 * 1024 * 1024
    if (file.size > maxSize) {
      return NextResponse.json({ error: '图片大小不能超过 5MB' }, { status: 400 })
    }

    const ext = file.name.toLowerCase().match(/\.(png|jpe?g)$/i)?.[0] ?? (file.type === 'image/jpeg' ? '.jpg' : '.png')
    const key = generateCertificateStampKey(ext)
    const buffer = Buffer.from(await file.arrayBuffer())
    const result = await uploadToQiniu(buffer, key)
    if (!result.success) {
      console.error('[certificate-stamp] upload failed:', result.error)
      return NextResponse.json({ error: result.error || '上传失败，请重试' }, { status: 500 })
    }

    return NextResponse.json({ success: true, key: result.key })
  } catch (error) {
    console.error('[certificate-stamp] upload error:', error)
    return NextResponse.json({ error: '上传失败，请重试' }, { status: 500 })
  }
}
