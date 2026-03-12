import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import OperatorLayoutClient from '../OperatorLayoutClient'

async function getOperatorSession() {
  const cookieStore = await cookies()
  const session = cookieStore.get('operator_session')
  if (!session) return null
  try {
    return JSON.parse(session.value) as { operatorId: string; name: string; role: string }
  } catch {
    return null
  }
}

export default async function OperatorDashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getOperatorSession()

  if (!session?.operatorId) {
    redirect('/operator/login')
  }

  return <OperatorLayoutClient operatorName={session.name}>{children}</OperatorLayoutClient>
}
