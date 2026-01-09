import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { getRewardConfigs } from '@/app/actions/systemConfig'
import RewardsConfigClient from './RewardsConfigClient'

export default async function RewardsConfigPage() {
  // 检查管理员登录
  const cookieStore = await cookies()
  const adminSession = cookieStore.get('admin_session')

  if (!adminSession) {
    redirect('/admin/login')
  }

  // 获取当前配置
  const result = await getRewardConfigs()

  if (!result.success || !result.configs) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800">加载配置失败</p>
        </div>
      </div>
    )
  }

  return <RewardsConfigClient configs={result.configs} />
}
