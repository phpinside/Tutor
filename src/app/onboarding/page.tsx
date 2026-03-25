import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { getRejectedDirectReferralForReferred } from '@/app/actions/referral'
import { getTeacher } from '@/app/actions/teacher'
import { getTaskConfigs, getPhaseConfigs } from '@/lib/config'
import { formatDateTime } from '@/lib/utils'
import ProgressBar from '@/components/ui/ProgressBar'
import PhaseIndicator from '@/components/ui/PhaseIndicator'
import TaskCard from '@/components/ui/TaskCard'
import ReferralCodeSaver from './ReferralCodeSaver'
import ReferralRevisionResubmit from './ReferralRevisionResubmit'

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
    teacher = await getTeacher(teacherId)
  } catch (error) {
    // 如果获取失败（比如 teacherId 无效），重定向到登录页
    redirect(refCode ? `/auth/register?ref=${refCode}` : '/auth/login')
  }
  
  // 如果有 ref 参数且用户没有邀请人，重定向到 init 处理邀请关系
  if (refCode && !teacher.invitedById) {
    redirect(`/api/init?ref=${refCode}`)
  }
  
  // 从数据库获取任务和阶段配置
  const TASKS_CONFIG = await getTaskConfigs()
  const PHASES_CONFIG = await getPhaseConfigs()
  const rejectedReferral = await getRejectedDirectReferralForReferred(teacherId)

  const allTasksDone =
    teacher.status === 'COMPLETED' ||
    teacher.status === 'UNLOCKED' ||
    teacher.currentTaskIndex >= TASKS_CONFIG.length

  // 如果已完成所有任务且邀请未被驳回，跳转到完成页
  if (allTasksDone && !rejectedReferral) {
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
  
  // 确定当前阶段（已完成全部任务但处于返工时，用最后一阶段避免指示器回到第 1 阶段）
  const lastPhase = TASKS_CONFIG[TASKS_CONFIG.length - 1]?.phase ?? 1
  const currentPhase = currentTask?.phase ?? (allTasksDone ? lastPhase : 1)
  
  // 转换阶段配置格式供 PhaseIndicator 使用
  const phaseIndicatorData = PHASES_CONFIG.map(p => ({
    number: p.phase,
    title: p.title
  }))
  
  const taskStepsLabel =
    rejectedReferral && allTasksDone
      ? '任务步骤（可点击进入修改）'
      : '已完成的任务(点击可查看或修改)'

  return (
    <div className="animate-fade-in">
      {/* 保存邀请码到 localStorage */}
      {refCode && <ReferralCodeSaver refCode={refCode} />}

      {rejectedReferral && (
        <div className="mb-8 p-5 rounded-xl border-2 border-red-300 bg-red-50 text-red-950 shadow-sm">
          <h2 className="text-lg font-bold text-red-900 mb-2">邀请审核未通过</h2>
          <p className="text-sm text-red-900/90 mb-2">
            请根据下方说明修改对应任务内容，保存后点击下方按钮重新提交审核。
          </p>
          {rejectedReferral.adminNote ? (
            <div className="mt-3 p-3 rounded-lg bg-white/80 border border-red-200">
              <p className="text-xs font-semibold text-red-800 mb-1">审核说明</p>
              <p className="text-sm text-red-950 whitespace-pre-wrap">{rejectedReferral.adminNote}</p>
            </div>
          ) : (
            <p className="text-sm text-red-800 mt-2">管理员未填写具体说明，如有疑问请联系运营人员。</p>
          )}
          {rejectedReferral.reviewedAt && (
            <p className="text-xs text-red-700/80 mt-3">
              审核时间：{formatDateTime(rejectedReferral.reviewedAt)}
            </p>
          )}
          {allTasksDone && <ReferralRevisionResubmit />}
        </div>
      )}
      
      {/* 欢迎标题 */}
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          {rejectedReferral && allTasksDone
            ? teacher.name
              ? `${teacher.name}，请按要求修改后重新提交`
              : '请按要求修改后重新提交审核'
            : teacher.name
              ? `欢迎回来,${teacher.name}!`
              : '欢迎加入伴学团队!'}
        </h1>
        <p className="text-gray-600">
          {rejectedReferral && allTasksDone
            ? '点击下方任务步骤进入对应页面，修改并保存即可。'
            : '完成新手任务,开启你的数学伴学之旅'}
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
            <p className="text-xs text-gray-500 mb-3">{taskStepsLabel}</p>
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
