import { NextRequest, NextResponse } from 'next/server'
import { cookies } from '@/lib/auth/compat'
import { uploadToQiniu } from '@/lib/qiniu'

// 教练资质证明上传：学历学位/在读证明、教师资格证、普通话等级证、质疑取证补交材料
// 支持图片与 PDF（学信网在线验证报告常为 PDF）
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
      return NextResponse.json({ error: '请选择要上传的文件' }, { status: 400 })
    }

    const validTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'application/pdf']
    if (!validTypes.includes(file.type)) {
      return NextResponse.json(
        { error: '只支持 PNG、JPG、WEBP 图片或 PDF 文件' },
        { status: 400 }
      )
    }

    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: '文件大小不能超过 10MB' }, { status: 400 })
    }

    const ext =
      file.type === 'image/png'
        ? 'png'
        : file.type === 'image/webp'
          ? 'webp'
          : file.type === 'application/pdf'
            ? 'pdf'
            : 'jpg'
    const key = `uploads/qualifications/${teacherId}-${Date.now()}.${ext}`

    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    const result = await uploadToQiniu(buffer, key)
    if (!result.success) {
      return NextResponse.json({ error: result.error || '上传失败，请重试' }, { status: 500 })
    }

    return NextResponse.json({ success: true, key: result.key })
  } catch (error) {
    console.error('上传资质证明失败:', error)
    return NextResponse.json({ error: '上传失败，请重试' }, { status: 500 })
  }
}
