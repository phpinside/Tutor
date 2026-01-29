import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { getOrCreateTeacher } from '@/app/actions/teacher'
import { getTaskConfigs, getPhaseConfigs } from '@/lib/config'
import ProgressBar from '@/components/ui/ProgressBar'
import PhaseIndicator from '@/components/ui/PhaseIndicator'
import TaskCard from '@/components/ui/TaskCard'
import ReferralCodeSaver from './ReferralCodeSaver'

export default async function OnboardingPage({
  searchParams
}: {
  searchParams: Promise<{ ref?: string }>
}) {
  const params = await searchParams
  const refCode = params.ref
  
  // 获取老师信息
  const cookieStore = await cookies()
  const teacherId = cookieStore.get('teacherId')?.value
  
  // 如果没有 teacherId，重定向到登录页
  if (!teacherId) {
    redirect(refCode ? `/auth/register?ref=${refCode}` : '/auth/login')
  }
  
  let teacher
  try {
    teacher = await getOrCreateTeacher(teacherId)
  } catch (error) {
    // 如果获取失败（比如 teacherId 无效），重定向到登录页
    redirect(refCode ? `/auth/register?ref=${refCode}` : '/auth/login')
  }
  
  // 检查是否有手机号和密码（老用户需要补充信息）
  if (!teacher.phone || !teacher.password) {
    redirect('/auth/complete')
  }
  
  // 如果有 ref 参数且用户没有邀请人，重定向到 init 处理邀请关系
  if (refCode && !teacher.invitedById) {
    redirect(`/api/init?ref=${refCode}`)
  }
  
  // 从数据库获取任务和阶段配置
  const TASKS_CONFIG = await getTaskConfigs()
  const PHASES_CONFIG = await getPhaseConfigs()
  
  // 如果已完成所有任务,跳转到完成页
  if (
    teacher.status === 'COMPLETED' || 
    teacher.status === 'UNLOCKED' ||
    teacher.currentTaskIndex >= TASKS_CONFIG.length
  ) {
    redirect('/onboarding/complete')
  }
  
  // 获取当前任务
  const currentTask = TASKS_CONFIG[teacher.currentTaskIndex]
  const currentSubmission = teacher.taskSubmissions.find(
    s => s.taskIndex === teacher.currentTaskIndex
  )
  
  // 计算进度：当前任务索引就是已完成的任务数
  const completedTasks = teacher.currentTaskIndex
  
  // 获取已完成的任务列表（当前任务之前的所有任务）
  const completedTasksList = TASKS_CONFIG.slice(0, teacher.currentTaskIndex)
  
  // 确定当前阶段
  const currentPhase = currentTask?.phase || 1
  
  // 转换阶段配置格式供 PhaseIndicator 使用
  const phaseIndicatorData = PHASES_CONFIG.map(p => ({
    number: p.phase,
    title: p.title
  }))
  
  return (
    <div className="animate-fade-in">
      {/* 保存邀请码到 localStorage */}
      {refCode && <ReferralCodeSaver refCode={refCode} />}
      
      {/* 欢迎标题 */}
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          {teacher.name ? `欢迎回来,${teacher.name}!` : '欢迎加入伴学团队!'}
        </h1>
        <p className="text-gray-600">
          完成新手任务,开启你的数学伴学之旅
        </p>
      </div>
      
      {/* 电脑端体验提示 (仅移动端显示) */}
      <div className="md:hidden mb-6 p-4 bg-orange-50 border-2 border-orange-400 rounded-lg shadow-md text-center">
        <p className="text-base font-semibold text-orange-800">
          💻 建议在电脑下打开本引导系统，体验更佳！
        </p>
      </div>
      
      {/* 阶段指示器 */}
      <div className="mb-8">
        <PhaseIndicator currentPhase={currentPhase} phases={phaseIndicatorData} />
      </div>
      
      {/* 总体进度 */}
      <div className="card mb-8">
        <h3 className="text-sm font-medium text-gray-700 mb-3">你的进度</h3>
        <ProgressBar 
          current={completedTasks} 
          total={TASKS_CONFIG.length}
          showLabel={false}
        />
        
        {completedTasksList.length > 0 && (
          <div className="mt-4 pt-4 border-t border-gray-200">
            <p className="text-xs text-gray-500 mb-3">已完成的任务(点击可查看或修改)</p>
            <div className="flex flex-wrap gap-2">
              {completedTasksList.map(task => {
                const submission = teacher.taskSubmissions.find(s => s.taskIndex === task.index)
                return (
                  <a
                    key={task.index}
                    href={`/onboarding/task/${task.index}`}
                    className="inline-flex items-center gap-2 px-3 py-2 bg-success-50 border border-success-200 text-success-700 rounded-lg text-sm hover:bg-success-100 transition-colors"
                  >
                    <span>{task.emoji}</span>
                    <span className="font-medium">{task.title}</span>
                    {submission?.status === 'COMPLETED' && (
                      <span className="text-success-600">✓</span>
                    )}
                    {submission?.status === 'PENDING_FEEDBACK' && (
                      <span className="text-warning-600">⏳</span>
                    )}
                  </a>
                )
              })}
            </div>
          </div>
        )}
      </div>
      
      {/* 当前任务 */}
      {currentTask && (
        <div className="mb-6">
          <TaskCard
            task={currentTask}
            status={currentSubmission?.status}
            feedback={currentSubmission?.feedback}
            isCurrentTask={true}
          />
        </div>
      )}
      
      {/* 提示信息 */}
      <div className="mt-8 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <p className="text-sm text-blue-800">
          💡 <strong>温馨提示:</strong> 所有任务都可以随时中断,支持修改后重新提交
        </p>
      </div>
    </div>
  )
}
