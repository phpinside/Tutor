import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { uploadToQiniu, generatePrivateUrl } from '@/lib/qiniu'
import { QINIU_CONFIG } from '@/lib/config'

export async function POST(request: NextRequest) {
  try {
    // 从 session 中获取 operatorId
    const cookieStore = await cookies()
    const session = cookieStore.get('operator_session')
    if (!session) {
      return NextResponse.json({ error: '未登录' }, { status: 401 })
    }
    const { operatorId } = JSON.parse(session.value)
    if (!operatorId) {
      return NextResponse.json({ error: '无效的 session' }, { status: 401 })
    }

    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ error: '请选择要上传的文件' }, { status: 400 })
    }

    const validTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp']
    if (!validTypes.includes(file.type)) {
      return NextResponse.json(
        { error: '只支持 PNG、JPG、JPEG、WEBP 格式的图片' },
        { status: 400 }
      )
    }

    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: '文件大小不能超过 5MB' }, { status: 400 })
    }

    const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg'
    // 带时间戳的唯一 key，避免私有 bucket 覆盖上传的各种限制（614 / download token）
    const key = `qrcode/operators/${operatorId}-${Date.now()}.${ext}`

    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    const result = await uploadToQiniu(buffer, key)

    if (!result.success) {
      return NextResponse.json({ error: result.error || '上传失败' }, { status: 500 })
    }

    // 生成 10 小时有效期的签名 URL 用于前端即时预览
    const signedUrl = generatePrivateUrl(result.key, Math.floor(Date.now() / 1000) + 36000)
    const plainUrl = `${QINIU_CONFIG.domain}/${result.key}`

    return NextResponse.json({ success: true, url: plainUrl, signedUrl, key: result.key })
  } catch (error) {
    console.error('上传运营人员二维码失败:', error)
    return NextResponse.json({ error: '上传失败，请重试' }, { status: 500 })
  }
}
