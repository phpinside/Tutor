import { getCurrentSession } from './session'
import { isTeacherInScope } from '@/lib/learnerManagerScope'

export async function assertTeacherAccess(teacherId: string, ownerOnly = false) {
  const session = await getCurrentSession()
  if (session?.activeRole === 'TEACHER' && session.teacherId === teacherId) return
  if (!ownerOnly && session?.activeRole === 'SUPER_ADMIN') return
  if (!ownerOnly && session?.operatorId && ['LEARNER_MANAGER', 'OPERATOR'].includes(session.activeRole) && await isTeacherInScope(session.operatorId, teacherId) !== false) return
  throw new Error('无权访问该教练资料，请重新登录或联系管理员')
}
