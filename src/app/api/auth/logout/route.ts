import { isSameOrigin } from '@/lib/auth/origin'
import { NextResponse } from 'next/server'
import { logoutReferrer } from '@/app/actions/auth'
export async function POST(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ success: false }, { status: 403 })
  return NextResponse.json(await logoutReferrer())
}
