import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { generatePrivateUrl } from '@/lib/qiniu'

// 教练查看自己申请中的证明材料截图（私有桶签名临时 URL）
// key 由服务端生成，前缀含 teacherId，可据此做归属校验
export async function GET(request: NextRequest) {
  try {
    const teacherId = (await cookies()).get('teacherId')?.value
    if (!teacherId) {
      return NextResponse.json({ error: '请先登录' }, { status: 401 })
    }

    const key = request.nextUrl.searchParams.get('key') ?? ''
    if (!key.startsWith(`uploads/info-change-proof/${teacherId}-`)) {
      return NextResponse.json({ error: '无权访问该图片' }, { status: 403 })
    }

    const signedUrl = generatePrivateUrl(key, Math.floor(Date.now() / 1000) + 3600)
    return NextResponse.json({ success: true, url: signedUrl })
  } catch (error) {
    console.error('生成证明材料签名 URL 失败:', error)
    return NextResponse.json({ error: '获取图片失败' }, { status: 500 })
  }
}
