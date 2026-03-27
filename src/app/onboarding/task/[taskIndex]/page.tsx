import { cookies } from 'next/headers'
import { redirect, notFound } from 'next/navigation'
import { getTeacher } from '@/app/actions/teacher'
import { getTaskSubmission } from '@/app/actions/task'
import { getTaskConfigs, QINIU_CONFIG } from '@/lib/config'
import { generatePrivateUrl } from '@/lib/qiniu'
import TaskIntro from '@/components/tasks/TaskIntro'
import TaskForm from '@/components/tasks/TaskForm'
import TaskVideoUpload from '@/components/tasks/TaskVideoUpload'
import TaskTraining from '@/components/tasks/TaskTraining'
import TaskOnlineTest from '@/components/tasks/TaskOnlineTest'
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
  const useNarrowLayout = task.type === 'ONLINE_TEST'

  // 为学管老师二维码生成签名 URL（私有 bucket 需要签名才能访问）
  const rawQrCode = teacher.teamAssignment?.operator?.wechatQrCode ?? null
  const qrCodeUrl = rawQrCode
    ? generatePrivateUrl(
        rawQrCode.replace(`${QINIU_CONFIG.domain}/`, ''),
        Math.floor(Date.now() / 1000) + 7200 // 2 小时有效期
      )
    : null
  
  // 渲染对应的任务组件
  const renderTaskContent = () => {
    switch (task.type) {
      case 'INFO':
        return <TaskIntro task={task} teacherId={teacherId} submission={submission} />
      
      case 'FORM':
        return <TaskForm task={task} teacherId={teacherId} teacher={teacher} submission={submission} />
      
      case 'VIDEO_UPLOAD':
        return <TaskVideoUpload task={task} teacherId={teacherId} submission={submission} teacher={teacher} />
      
      case 'TRAINING':
        return <TaskTraining task={task} teacherId={teacherId} submission={submission} />
      
      case 'ONLINE_TEST':
        return <TaskOnlineTest task={task} teacherId={teacherId} submission={submission} />
      
      default:
        return <div>未知任务类型</div>
    }
  }
  
  return (
    <div className="animate-fade-in">
      <div className={useNarrowLayout ? 'max-w-2xl mx-auto' : undefined}>
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


        {/* 伴学团队支持卡片 - 仅在任务3及以后显示 */}
        {taskIndex > 2 && teacher.teamAssignment?.operator && (
          <div className="card mb-6 bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-100">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              🤝  伴学团队支持
            </h3>
            <div className="flex items-start gap-6">
              {/* 左侧：二维码 */}
              <div className="flex-shrink-0 flex flex-col items-center gap-2">
                {qrCodeUrl ? (
                  <div className="w-28 h-28 rounded-xl border border-blue-100 shadow-sm overflow-hidden flex-shrink-0">
                    <img
                      src={qrCodeUrl}
                      alt={`${teacher.teamAssignment.operator.name}的微信二维码`}
                      className="w-full h-full object-contain"
                    />
                  </div>
                ) : (
                  <div className="w-28 h-28 rounded-xl bg-blue-100 flex items-center justify-center">
                    <svg className="w-9 h-9 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </div>
                )}
                <span className="text-xs text-gray-400 text-center">扫码添加{teacher.teamAssignment.operator.name}老师微信</span>
              </div>

              {/* 右侧：说明文字 */}
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-600 leading-relaxed">
                每位伴学老师都会加入一个由学管老师负责管理的伴学团队。
                </p>
                <p className="text-sm text-gray-600 leading-relaxed">
                在教学、家长沟通或系统使用过程中，如遇到任何问题，都可以随时向学管老师咨询与求助。
                 </p>
                 <p className="text-sm text-gray-600 leading-relaxed">
                学管老师会为老师提供及时的支持与指导，帮助大家更顺利地完成教学与服务工作。               
                 </p>
              </div>
            </div>
          </div>
        )}



        {/* 任务内容 */}
        {renderTaskContent()}
      </div>
    </div>
  )
}

