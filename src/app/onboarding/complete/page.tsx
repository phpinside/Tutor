import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { getOrCreateTeacher, updateTeacherStatus } from '@/app/actions/teacher'
import { getTaskConfigs } from '@/lib/config'
import Link from 'next/link'

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
  
  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="max-w-2xl w-full animate-fade-in">
        {/* 庆祝动画区域 */}
        <div className="text-center mb-8">
          <div className="inline-block animate-bounce">
            <span className="text-8xl">🎉</span>
          </div>
        </div>
        
        {/* 恭喜文案 */}
        <div className="card text-center">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">
            恭喜你完成所有新手任务!
          </h1>
          <p className="text-lg text-gray-600 mb-8">
            你已经成功解锁{' '}
            <span className="text-primary-600 font-semibold">数学伴学老师</span>
            {' '}身份
          </p>
          
          {/* 身份卡片 */}
          <div className="bg-gradient-to-br from-primary-500 to-indigo-600 rounded-xl p-8 text-white mb-8 shadow-lg">
            <div className="flex items-center justify-center gap-4 mb-4">
              <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center text-3xl">
                🎓
              </div>
              <div className="text-left">
                <p className="text-sm opacity-90">认证伴学老师</p>
                <p className="text-2xl font-bold">{teacher.name || '新老师'}</p>
              </div>
            </div>
            <div className="flex justify-around text-center mt-6 pt-6 border-t border-white/20">
              <div>
                <p className="text-3xl font-bold">✓</p>
                <p className="text-xs opacity-90 mt-1">已完成培训</p>
              </div>
              <div>
                <p className="text-3xl font-bold">6</p>
                <p className="text-xs opacity-90 mt-1">完成任务</p>
              </div>
              <div>
                <p className="text-3xl font-bold">🚀</p>
                <p className="text-xs opacity-90 mt-1">准备就绪</p>
              </div>
            </div>
          </div>
          
          {/* 下一步 */}
          <div className="space-y-4">
            <h2 className="text-xl font-semibold text-gray-900">
              接下来你可以:
            </h2>
            
            <div className="grid gap-4 md:grid-cols-2">
              <Link
                href="/orders"
                className="card-hover text-left p-6 border-2 border-primary-500"
              >
                <div className="text-3xl mb-3">📚</div>
                <h3 className="font-semibold text-gray-900 mb-2">开始接单</h3>
                <p className="text-sm text-gray-600">
                  查看可接的学员订单,开启你的伴学之旅
                </p>
              </Link>
              
              <Link
                href="/dashboard"
                className="card-hover text-left p-6"
              >
                <div className="text-3xl mb-3">📊</div>
                <h3 className="font-semibold text-gray-900 mb-2">个人中心</h3>
                <p className="text-sm text-gray-600">
                  查看你的课程安排、收入统计等信息
                </p>
              </Link>
            </div>
            
            <Link
              href="/help"
              className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              有问题? 查看帮助文档
            </Link>
          </div>
        </div>
        
        {/* 欢迎语 */}
        <div className="mt-8 text-center">
          <p className="text-gray-600">
            期待在伴学的旅程中,看到你的精彩表现 🌟
          </p>
        </div>
      </div>
    </div>
  )
}

