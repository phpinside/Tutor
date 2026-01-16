import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { getOrCreateTeacher } from '@/app/actions/teacher'
import { getTaskConfigs } from '@/lib/config'
import { TeacherStatus } from '@prisma/client'
import CompletionContent from './CompletionContent'
import EvaluationGuard from './EvaluationGuard'

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
  
  // 如果还没完成所有任务，重定向回引导页
  if (!allCompleted && teacher.status !== TeacherStatus.COMPLETED && teacher.status !== TeacherStatus.UNLOCKED) {
    redirect('/onboarding')
  }
  
  // 只有状态为 COMPLETED 或 UNLOCKED 的用户才能访问完成页面
  if (teacher.status !== TeacherStatus.COMPLETED && teacher.status !== TeacherStatus.UNLOCKED) {
    redirect('/onboarding/evaluation')
  }
  
  return (
    <>
      {/* 客户端组件：检查 localStorage 中的评估状态 */}
      <EvaluationGuard teacherId={teacherId} />
      
      <CompletionContent 
        teacherName={teacher.name} 
        teacherId={teacherId} 
        totalTasks={TOTAL_TASKS}
      />
    </>
  )
}
