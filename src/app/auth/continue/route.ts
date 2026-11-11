import { NextResponse, type NextRequest } from 'next/server'
import { getCurrentSession, startSession } from '@/lib/auth/session'
import { chooseWorkspace } from '@/lib/auth/policy'
export async function GET(request: NextRequest) {
  const session = await getCurrentSession()
  if (!session) {
    const url = new URL('/auth/login', request.url)
    url.search = request.nextUrl.search
    return NextResponse.redirect(url)
  }
  const workspace = chooseWorkspace(session.roles, session.activeRole, session.defaultRole, request.nextUrl.searchParams.get('redirect'))!
  if (workspace.role !== session.activeRole) await startSession(session.accountId, workspace.role)
  return NextResponse.redirect(new URL(workspace.destination, request.url))
}
