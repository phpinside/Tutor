import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { getOrCreateTeacher, updateTeacherStatus, ensureInviteCodes } from '@/app/actions/teacher'
import { getTaskConfigs } from '@/lib/config'
import CompletionContent from './CompletionContent'

export default async function CompletePage() {
  const cookieStore = await cookies()
  const teacherId = cookieStore.get('teacherId')?.value
  
  if (!teacherId) {
    redirect('/onboarding')
  }
  
  const teacher = await getOrCreateTeacher(teacherId)
  
  // 从数据库获取任务总数
  const TASKS_CONFIG = await getTaskConfigs()
  const TOTAL_TASKS = TASKS_CONFIG.length
  const allCompleted = teacher.currentTaskIndex >= TOTAL_TASKS
  
  // 如果还没完成所有任务,重定向回引导页
  if (!allCompleted && teacher.status !== 'COMPLETED' && teacher.status !== 'UNLOCKED') {
    redirect('/onboarding')
  }
  
  // 自动更新状态为已完成
  if (teacher.status !== 'COMPLETED' && teacher.status !== 'UNLOCKED') {
    await updateTeacherStatus(teacherId, 'COMPLETED')
  }
  
  // 生成邀请码和查看码
  const codesResult = await ensureInviteCodes(teacherId)
  const inviteCodes = codesResult.success ? {
    inviteCode: codesResult.inviteCode,
    viewCode: codesResult.viewCode
  } : null
  
  return (
    <CompletionContent 
      teacherName={teacher.name} 
      teacherId={teacherId} 
      totalTasks={TOTAL_TASKS}
      inviteCodes={inviteCodes}
    />
  )
}
