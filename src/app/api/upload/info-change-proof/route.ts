import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { uploadToQiniu } from '@/lib/qiniu'

// 教练资料修改申请：上传高考成绩查询截图（证明材料）
export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const teacherId = cookieStore.get('teacherId')?.value
    if (!teacherId) {
      return NextResponse.json({ error: '请先登录' }, { status: 401 })
    }

    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ error: '请选择要上传的截图' }, { status: 400 })
    }

    const validTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp']
    if (!validTypes.includes(file.type)) {
      return NextResponse.json(
        { error: '只支持 PNG、JPG、WEBP 格式的图片' },
        { status: 400 }
      )
    }

    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: '图片大小不能超过 10MB' }, { status: 400 })
    }

    const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg'
    const key = `uploads/info-change-proof/${teacherId}-${Date.now()}.${ext}`

    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    const result = await uploadToQiniu(buffer, key)
    if (!result.success) {
      return NextResponse.json({ error: result.error || '上传失败，请重试' }, { status: 500 })
    }

    // 返回 key：查看时按私有桶签名生成临时 URL，不落库完整地址
    return NextResponse.json({ success: true, key: result.key })
  } catch (error) {
    console.error('上传高考成绩截图失败:', error)
    return NextResponse.json({ error: '上传失败，请重试' }, { status: 500 })
  }
}
