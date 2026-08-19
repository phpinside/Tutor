import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import QuickLoginHelperClient from './QuickLoginHelperClient'

export default async function QuickLoginHelperPage() {
  const cookieStore = await cookies()
  const teacherId = cookieStore.get('teacherId')?.value

  if (!teacherId) {
    redirect('/auth/login')
  }

  return (
    <div className="animate-fade-in">
      <div className="mb-8">
        <Link
          href="/onboarding/tools"
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 transition-colors mb-4"
        >
          ← 返回工具列表
        </Link>
        <div className="flex items-center gap-3 mb-2">
          <span className="text-3xl">🚀</span>
          <h1 className="text-2xl font-bold text-gray-900">快捷登录助手</h1>
        </div>
        <p className="text-gray-600">
          安装一次，以后打开 B 网站点击书签即可完成初始化
        </p>
      </div>

      <QuickLoginHelperClient />
    </div>
  )
}
