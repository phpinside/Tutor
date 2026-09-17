import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// 已被永久拒绝入驻的教练会话踢出：
// 删除登录 cookie 后回到登录页并展示拒绝提示。
// 页面检测到 permanentlyRejectedAt 时 redirect 到本接口
// （Route Handler 才能修改 cookie，Server Component 中删除会抛错）。
export async function GET(request: NextRequest) {
  const nextPath = request.nextUrl.searchParams.get('next')
  const safeNext =
    nextPath && nextPath.startsWith('/') && !nextPath.startsWith('//')
      ? nextPath
      : '/onboarding'

  const teacherId = request.cookies.get('teacherId')?.value
  if (!teacherId) {
    return NextResponse.redirect(new URL('/auth/login', request.url))
  }

  const teacher = await prisma.teacher.findUnique({
    where: { id: teacherId },
    select: { permanentlyRejectedAt: true },
  })

  if (!teacher?.permanentlyRejectedAt) {
    // 非永久拒绝账号：不动会话，原路返回
    return NextResponse.redirect(new URL(safeNext, request.url))
  }

  const response = NextResponse.redirect(
    new URL('/auth/login?rejected=1', request.url)
  )
  response.cookies.delete('teacherId')
  return response
}
