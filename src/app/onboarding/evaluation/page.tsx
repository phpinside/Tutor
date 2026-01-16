import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { getOrCreateTeacher } from '@/app/actions/teacher'
import EvaluationContent from './EvaluationContent'

export default async function EvaluationPage() {
  const cookieStore = await cookies()
  const teacherId = cookieStore.get('teacherId')?.value
  
  if (!teacherId) {
    redirect('/onboarding')
  }
  
  const teacher = await getOrCreateTeacher(teacherId)
  
  // 检查教师状态
  // 如果还没完成所有任务，重定向回引导页
  if (teacher.status === 'NOT_STARTED') {
    redirect('/onboarding')
  }
  
  // 如果已经完成评估（通过或未通过），直接显示结果
  // 如果是 IN_PROGRESS 状态，说明刚提交完 Task 5，需要进行评估
  
  return (
    <EvaluationContent 
      teacherId={teacherId}
      teacherName={teacher.name || ''}
      currentStatus={teacher.status}
      mathScore={teacher.mathScore || ''}
    />
  )
}
