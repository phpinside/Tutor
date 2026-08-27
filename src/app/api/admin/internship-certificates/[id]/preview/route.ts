import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { prisma } from '@/lib/prisma'
import { generatePrivateUrl } from '@/lib/qiniu'

/** 管理员预览实习证明基础 PDF（系统生成或用户上传，均存于 pdfKey），用于拖拽公章定位。 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const cookieStore = await cookies()
  const adminSession = cookieStore.get('admin_session')
  if (!adminSession) {
    return NextResponse.json({ error: '请先登录管理员账号' }, { status: 401 })
  }
  try {
    const data = JSON.parse(adminSession.value)
    if (data.role !== 'super_admin') {
      return NextResponse.json({ error: '仅超级管理员可预览' }, { status: 403 })
    }
  } catch {
    return NextResponse.json({ error: '请先登录管理员账号' }, { status: 401 })
  }

  const { id } = await params
  const draft = await prisma.internshipCertificateDraft.findUnique({
    where: { id },
    select: { status: true, pdfKey: true },
  })
  if (!draft) {
    return NextResponse.json({ error: '申请记录不存在' }, { status: 404 })
  }
  if (draft.status !== 'COMPLETED') {
    return NextResponse.json({ error: '该申请不在待开具状态' }, { status: 400 })
  }
  if (!draft.pdfKey) {
    return NextResponse.json({ error: '基础 PDF 缺失' }, { status: 400 })
  }

  try {
    const url = generatePrivateUrl(draft.pdfKey)
    const res = await fetch(url, { signal: AbortSignal.timeout(15_000) })
    if (!res.ok) throw new Error('获取 PDF 失败')
    if (!res.body) throw new Error('PDF 响应为空')

    const headers = new Headers({
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'inline; filename="internship-certificate-preview.pdf"',
      // URL 带 completedAt 版本号；同一版本可安全复用，重新提交后会生成新 URL。
      'Cache-Control': 'private, max-age=3600',
    })
    const contentLength = res.headers.get('content-length')
    if (contentLength && !res.headers.has('content-encoding')) {
      headers.set('Content-Length', contentLength)
    }

    // 直接转发七牛响应流，避免服务端完整缓冲后浏览器才开始接收。
    return new NextResponse(res.body, {
      status: 200,
      headers,
    })
  } catch (error) {
    console.error('[internship-certificate] preview failed:', error)
    return NextResponse.json({ error: 'PDF 预览加载失败，请稍后重试' }, { status: 500 })
  }
}
