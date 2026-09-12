import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { getCoachReviewPoolConfig } from '@/app/actions/coachReviewConfigActions'
import CoachReviewPoolClient from './CoachReviewPoolClient'

export const dynamic = 'force-dynamic'

export default async function CoachReviewPoolPage() {
  const cookieStore = await cookies()
  const adminSession = cookieStore.get('admin_session')

  if (!adminSession) {
    redirect('/admin/login')
  }

  const result = await getCoachReviewPoolConfig()

  if (!result.success || !result.operators) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800">加载配置失败</p>
        </div>
      </div>
    )
  }

  return <CoachReviewPoolClient operators={result.operators} />
}
