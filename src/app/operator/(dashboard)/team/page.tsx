import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { getOperatorTeam } from '@/app/actions/operatorActions'
import TeamManagementClient from '../../team/TeamManagementClient'

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

export default async function TeamPage({
  searchParams,
}: {
  searchParams: Promise<{
    search?: string
    taskIndex?: string
    startDate?: string
    endDate?: string
  }>
}) {
  const session = await getOperatorSession()
  if (!session) redirect('/operator/login')

  const params = await searchParams
  const { search, taskIndex, startDate, endDate } = params

  const teachers = await getOperatorTeam(session.operatorId, {
    search,
    taskIndex,
    startDate,
    endDate,
  })

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">团队人员管理</h1>
        <p className="text-gray-600">管理你的老师团队，可以添加或移除团队成员</p>
      </div>

      <TeamManagementClient
        operatorId={session.operatorId}
        initialTeachers={teachers}
        initialFilters={{ search, taskIndex, startDate, endDate }}
      />
    </div>
  )
}
