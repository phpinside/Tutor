import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { getLearningPlannerApplications } from '@/app/actions/learningPlanner'
import { extractQiniuKey, generatePrivateUrl } from '@/lib/qiniu'
import PlannerReviewManagementClient from '../../planner-review/PlannerReviewManagementClient'

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

export default async function PlannerReviewPage({
  searchParams,
}: {
  searchParams: Promise<{
    search?: string
    reviewStatus?: string
    startDate?: string
    endDate?: string
  }>
}) {
  const session = await getOperatorSession()
  if (!session?.operatorId) {
    redirect('/operator/login')
  }

  const params = await searchParams
  const result = await getLearningPlannerApplications({
    search: params.search,
    reviewStatus: params.reviewStatus,
    startDate: params.startDate,
    endDate: params.endDate,
  })

  if (!result.success || !result.applications || !result.stats) {
    return (
      <div className="card">
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-700">
          加载学习规划师审核列表失败
        </div>
      </div>
    )
  }

  const applications = result.applications.map((application) => ({
    ...application,
    signedStudyPlanPdfUrl: generatePrivateUrl(extractQiniuKey(application.studyPlanPdfUrl)),
  }))

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">规划师审核</h1>
        <p className="text-gray-600">查看并审核老师提交的学习规划师资格认证申请。</p>
      </div>

      <PlannerReviewManagementClient
        initialApplications={applications}
        initialFilters={params}
        stats={result.stats}
      />
    </div>
  )
}
