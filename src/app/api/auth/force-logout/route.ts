import { cookies } from '@/lib/auth/compat'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { safeDestination } from '@/lib/auth/policy'
import { getRequestUrl } from '@/lib/request-url'

// 已被永久拒绝入驻的教练会话踢出：
// 删除登录 cookie 后回到登录页并展示拒绝提示。
// 页面检测到 permanentlyRejectedAt 时 redirect 到本接口
// （Route Handler 才能修改 cookie，Server Component 中删除会抛错）。
export async function GET(request: NextRequest) {
  const nextPath = request.nextUrl.searchParams.get('next')
  const safeNext = safeDestination(nextPath) ?? '/onboarding'

  const teacherId = (await cookies()).get('teacherId')?.value
  if (!teacherId) {
    return NextResponse.redirect(getRequestUrl(request, '/auth/login'))
  }

  const teacher = await prisma.teacher.findUnique({
    where: { id: teacherId },
    select: { permanentlyRejectedAt: true },
  })

  if (!teacher?.permanentlyRejectedAt) {
    // 非永久拒绝账号：不动会话，原路返回
    return NextResponse.redirect(getRequestUrl(request, safeNext))
  }

  const response = NextResponse.redirect(
    getRequestUrl(request, '/auth/login?rejected=1')
  )
  response.cookies.delete('teacherId')
  return response
}
