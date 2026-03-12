import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { getOperatorProfile } from '@/app/actions/operatorActions'
import { generatePrivateUrl } from '@/lib/qiniu'
import { QINIU_CONFIG } from '@/lib/config'
import SettingsForm from '../../settings/SettingsForm'

export const dynamic = 'force-dynamic'

async function getOperatorSession() {
  const cookieStore = await cookies()
  const session = cookieStore.get('operator_session')
  if (!session) return null
  try {
    return JSON.parse(session.value) as { operatorId: string; name: string }
  } catch {
    return null
  }
}

export default async function SettingsPage() {
  const session = await getOperatorSession()
  if (!session) redirect('/operator/login')

  const profile = await getOperatorProfile(session.operatorId)
  if (!profile) redirect('/operator/login')

  // 服务端生成签名 URL 用于页面加载时预览（10 小时有效期）
  let initialDisplayUrl = ''
  if (profile.wechatQrCode) {
    const domain = QINIU_CONFIG.domain
    const key = profile.wechatQrCode.startsWith(domain + '/')
      ? profile.wechatQrCode.slice(domain.length + 1)
      : profile.wechatQrCode
    initialDisplayUrl = generatePrivateUrl(key, Math.floor(Date.now() / 1000) + 36000)
  }

  return (
    <div className="max-w-lg">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">资料设置</h1>
        <p className="text-gray-600">管理你的个人信息和账号设置</p>
      </div>

      <SettingsForm
        profile={profile}
        operatorId={session.operatorId}
        initialDisplayUrl={initialDisplayUrl}
      />
    </div>
  )
}
