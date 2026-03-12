import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { getTeacher } from '@/app/actions/teacher'
import { getTaskConfigs } from '@/lib/config'
import CompletionContent from './CompletionContent'

export default async function CompletePage() {
  const cookieStore = await cookies()
  const teacherId = cookieStore.get('teacherId')?.value
  
  if (!teacherId) {
    redirect('/onboarding')
  }
  
  const teacher = await getTeacher(teacherId)
  
  // 从数据库获取任务总数
  const TASKS_CONFIG = await getTaskConfigs()
  const TOTAL_TASKS = TASKS_CONFIG.length
  const allCompleted = teacher.currentTaskIndex >= TOTAL_TASKS
  
  // 如果还没完成所有任务，重定向回引导页
  if (!allCompleted) {
    redirect('/onboarding')
  }
  
  return (
    <CompletionContent 
      teacherName={teacher.name} 
      teacherId={teacherId} 
      totalTasks={TOTAL_TASKS}
    />
  )
}
