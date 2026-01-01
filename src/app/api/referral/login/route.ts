import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getReferralDataByViewCode } from '@/app/actions/teacher'
import { NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const viewCode = searchParams.get('viewCode')
  const returnUrl = searchParams.get('returnUrl')
  
  if (!viewCode) {
    return NextResponse.redirect(new URL('/onboarding', request.url))
  }
  
  // 获取邀请看板数据
  const result = await getReferralDataByViewCode(viewCode)
  
  if (!result.success || !result.data || !result.data.teacherId) {
    return NextResponse.redirect(new URL('/onboarding', request.url))
  }
  
  // 设置 cookie
  const cookieStore = await cookies()
  cookieStore.set('teacherId', result.data.teacherId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 365 // 1年
  })
  
  // 重定向回邀请看板，添加 login 参数避免循环
  const redirectUrl = returnUrl 
    ? `${returnUrl}?login=1`
    : `/referral/${viewCode}?login=1`
  
  return NextResponse.redirect(new URL(redirectUrl, request.url))
}
