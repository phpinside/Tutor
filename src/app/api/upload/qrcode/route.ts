import { NextRequest, NextResponse } from 'next/server'
import { uploadToQiniu, generateQRCodeKey, refreshCdnCache } from '@/lib/qiniu'

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json(
        { error: '请选择要上传的文件' },
        { status: 400 }
      )
    }

    // 验证文件类型
    const validTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp']
    if (!validTypes.includes(file.type)) {
      return NextResponse.json(
        { error: '只支持 PNG、JPG、JPEG、WEBP 格式的图片' },
        { status: 400 }
      )
    }

    // 验证文件大小（最大 5MB）
    const maxSize = 5 * 1024 * 1024
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: '文件大小不能超过 5MB' },
        { status: 400 }
      )
    }

    // 读取文件内容
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    // 获取固定的二维码 key
    const key = generateQRCodeKey()

    // 上传到七牛云
    const result = await uploadToQiniu(buffer, key)

    if (!result.success) {
      console.error('上传到七牛云失败:', result.error)
      return NextResponse.json(
        { error: result.error || '上传失败，请重试' },
        { status: 500 }
      )
    }

    console.log('二维码上传成功:', result.url)

    // 刷新 CDN 缓存，使覆盖上传的新图立即生效（失败不阻断响应）
    await refreshCdnCache([result.url])

    return NextResponse.json({
      success: true,
      message: '二维码上传成功',
      url: result.url,
      key: result.key
    })
  } catch (error) {
    console.error('上传二维码失败:', error)
    return NextResponse.json(
      { error: '上传失败，请重试' },
      { status: 500 }
    )
  }
}
