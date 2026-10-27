import { cookies } from 'next/headers'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import type { Prisma } from '@prisma/client'
import { getOperatorSessionInfo } from '@/lib/operatorAuth'
import { getScopedTeacherFilter } from '@/lib/learnerManagerScope'
import { toInfoChangeReviewItemView } from '@/lib/teacherInfoChangeServer'
import type { InfoChangeReviewItemView } from '@/lib/teacherInfoChangeShared'
import InfoChangeReviewClient from './InfoChangeReviewClient'

export const dynamic = 'force-dynamic'

/**
 * 教练资料修改审核工作台：
 * - 超管（admin_session）与运营/学管（operator_session）共用本页（middleware 放行 /admin/teachers/*）
 * - 学管仅可见白名单内教练的申请，且只能初审；复审仅运营/超管
 */
export default async function InfoChangeRequestsPage() {
  const operatorSession = await getOperatorSessionInfo()

  let viewerKind: 'ADMIN' | 'OPERATOR' | 'LEARNER_MANAGER'
  let operatorId: string | null = null

  if (operatorSession) {
    const operator = await prisma.operator.findUnique({
      where: { id: operatorSession.operatorId },
      select: { name: true, isEnabled: true, role: true },
    })
    if (!operator || !operator.isEnabled) {
      return (
        <div className="card">
          <p className="text-gray-600">账号已被停用，请联系管理员。</p>
        </div>
      )
    }
    if (operator.role !== 'OPERATOR' && operator.role !== 'LEARNER_MANAGER') {
      return (
        <div className="card">
          <p className="text-gray-600">当前账号角色无权访问该页面。</p>
        </div>
      )
    }
    viewerKind = operator.role
    operatorId = operatorSession.operatorId
  } else {
    const cookieStore = await cookies()
    const adminSession = cookieStore.get('admin_session')
    let isSuperAdmin = false
    try {
      isSuperAdmin = JSON.parse(adminSession?.value ?? '{}').role === 'super_admin'
    } catch {}
    if (!isSuperAdmin) {
      redirect('/admin/login')
    }
    viewerKind = 'ADMIN'
  }

  const where: Prisma.TeacherInfoChangeRequestWhereInput = {}
  if (viewerKind === 'LEARNER_MANAGER' && operatorId) {
    // 学管只看白名单内教练的申请；未启用灰度时保持现状（全量可见）
    const scoped = await getScopedTeacherFilter(operatorId)
    if (scoped) {
      where.teacher = scoped
    }
  }

  const rows = await prisma.teacherInfoChangeRequest.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: 200,
    include: {
      teacher: {
        select: {
          id: true,
          name: true,
          phone: true,
          gaokaoProvince: true,
          mathScore: true,
          physicsScore: true,
          chemistryScore: true,
        },
      },
    },
  })

  const items: InfoChangeReviewItemView[] = rows.map(toInfoChangeReviewItemView)

  return (
    <div>
      <Link
        href="/admin/teachers"
        className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6 transition-colors"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        返回老师列表
      </Link>

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">资料修改审核</h1>
        <p className="text-sm text-gray-600 mt-1">
          教练提交的姓名 / 高考省份 / 高考成绩修改申请，经学管初审、运营复审通过后生效。
          {viewerKind === 'LEARNER_MANAGER' && '（你以学管身份登录：可初审白名单内教练的申请）'}
        </p>
      </div>

      <InfoChangeReviewClient viewerKind={viewerKind} items={items} />
    </div>
  )
}
