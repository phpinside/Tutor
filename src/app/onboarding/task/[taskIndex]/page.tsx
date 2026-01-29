import { cookies } from 'next/headers'
import { redirect, notFound } from 'next/navigation'
import { getTeacher } from '@/app/actions/teacher'
import { getTaskSubmission } from '@/app/actions/task'
import { getTaskConfigs } from '@/lib/config'
import TaskIntro from '@/components/tasks/TaskIntro'
import TaskForm from '@/components/tasks/TaskForm'
import TaskVideoUpload from '@/components/tasks/TaskVideoUpload'
import TaskTraining from '@/components/tasks/TaskTraining'
import Link from 'next/link'

export default async function TaskPage({
  params
}: {
  params: Promise<{ taskIndex: string }>
}) {
  const { taskIndex: taskIndexStr } = await params
  const taskIndex = parseInt(taskIndexStr)
  
  // 从数据库获取任务配置
  const TASKS_CONFIG = await getTaskConfigs()
  
  // 验证任务索引
  if (isNaN(taskIndex) || taskIndex < 0 || taskIndex >= TASKS_CONFIG.length) {
    notFound()
  }
  
  // 获取老师信息
  const cookieStore = await cookies()
  const teacherId = cookieStore.get('teacherId')?.value
  
  if (!teacherId) {
    redirect('/onboarding')
  }
  
  const teacher = await getTeacher(teacherId)
  const task = TASKS_CONFIG[taskIndex]
  const submission = await getTaskSubmission(teacherId, taskIndex)
  
  // 渲染对应的任务组件
  const renderTaskContent = () => {
    switch (task.type) {
      case 'INFO':
        return <TaskIntro task={task} teacherId={teacherId} submission={submission} />
      
      case 'FORM':
        return <TaskForm task={task} teacherId={teacherId} teacher={teacher} submission={submission} />
      
      case 'VIDEO_UPLOAD':
      case 'PRACTICE':
        return <TaskVideoUpload task={task} teacherId={teacherId} submission={submission} />
      
      case 'TRAINING':
        return <TaskTraining task={task} teacherId={teacherId} submission={submission} />
      
      default:
        return <div>未知任务类型</div>
    }
  }
  
  return (
    <div className="animate-fade-in">
      {/* 返回按钮 */}
      <Link 
        href="/onboarding"
        className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6 transition-colors"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        返回首页
      </Link>
      
      {/* 任务头部 */}
      <div className="card mb-6">
        <div className="flex items-start gap-4">
          <span className="text-5xl">{task.emoji}</span>
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-2xl font-bold text-gray-900">
                {task.title}
              </h1>
              {task.isOptional && (
                <span className="badge-gray">可选</span>
              )}
            </div>
            <p className="text-gray-600">
              {task.description}
            </p>
          </div>
        </div>
      </div>
      
      {/* 任务内容 */}
      {renderTaskContent()}
    </div>
  )
}

