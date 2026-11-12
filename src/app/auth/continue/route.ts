import { NextResponse, type NextRequest } from 'next/server'
import { getCurrentSession, startSession } from '@/lib/auth/session'
import { chooseWorkspace } from '@/lib/auth/policy'
import { getRequestUrl } from '@/lib/request-url'
export async function GET(request: NextRequest) {
  const session = await getCurrentSession()
  if (!session) {
    const url = getRequestUrl(request, '/auth/login')
    url.search = request.nextUrl.search
    return NextResponse.redirect(url)
  }
  const workspace = chooseWorkspace(session.roles, session.activeRole, session.defaultRole, request.nextUrl.searchParams.get('redirect'))!
  if (workspace.role !== session.activeRole) await startSession(session.accountId, workspace.role)
  return NextResponse.redirect(getRequestUrl(request, workspace.destination))
}
