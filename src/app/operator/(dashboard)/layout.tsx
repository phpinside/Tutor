import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import OperatorLayoutClient from '../OperatorLayoutClient'
import { canManageWechatGroupQr } from '@/lib/wechatGroupQrAuth'

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

  // 「微信群二维码」配置能力随「运营复审权限」开关联动
  const canManageGroupQr = await canManageWechatGroupQr()

  return (
    <OperatorLayoutClient operatorName={session.name} canManageGroupQr={canManageGroupQr}>
      {children}
    </OperatorLayoutClient>
  )
}
