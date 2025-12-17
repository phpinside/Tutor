import { prisma } from '@/lib/prisma'
import { getTaskConfigs } from '@/lib/config'
import { getTeacherStatusText, getTaskStatusText } from '@/lib/utils'
import { notFound } from 'next/navigation'
import Link from 'next/link'

export default async function TeacherDetailPage({
  params
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  
  const TASKS_CONFIG = await getTaskConfigs()
  
  const teacher = await prisma.teacher.findUnique({
    where: { id },
    include: {
      taskSubmissions: {
        orderBy: { taskIndex: 'asc' }
      }
    }
  })
  
  if (!teacher) {
    notFound()
  }
  
  return (
    <div>
      {/* 返回按钮 */}
      <Link
        href="/admin/teachers"
        className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6 transition-colors"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        返回列表
      </Link>
      
      {/* 老师基本信息 */}
      <div className="card mb-8">
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              {teacher.name || '未命名老师'}
            </h1>
            <p className="text-gray-600">
              ID: {teacher.id}
            </p>
          </div>
          <span className={`badge text-base ${
            teacher.status === 'UNLOCKED' ? 'badge-success' :
            teacher.status === 'COMPLETED' ? 'badge-primary' :
            'badge-gray'
          }`}>
            {getTeacherStatusText(teacher.status)}
          </span>
        </div>
        
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
          <div>
            <p className="text-gray-500 mb-1">学校</p>
            <p className="font-medium text-gray-900">{teacher.school || '未填写'}</p>
          </div>
          <div>
            <p className="text-gray-500 mb-1">专业</p>
            <p className="font-medium text-gray-900">{teacher.major || '未填写'}</p>
          </div>
          <div>
            <p className="text-gray-500 mb-1">擅长年级</p>
            <div className="font-medium text-gray-900">
              {teacher.gradePreference ? (
                <div className="flex gap-1 flex-wrap">
                  {teacher.gradePreference.split(',').map((grade, index) => (
                    <span key={index} className="badge-primary text-xs">
                      {grade.trim()}
                    </span>
                  ))}
                </div>
              ) : (
                '未填写'
              )}
            </div>
          </div>
          <div>
            <p className="text-gray-500 mb-1">可工作时间</p>
            <p className="font-medium text-gray-900">{teacher.availableTime || '未填写'}</p>
          </div>
          <div>
            <p className="text-gray-500 mb-1">当前任务</p>
            <p className="font-medium text-gray-900">{teacher.currentTaskIndex} / 6</p>
          </div>
          <div>
            <p className="text-gray-500 mb-1">注册时间</p>
            <p className="font-medium text-gray-900">
              {new Date(teacher.createdAt).toLocaleDateString('zh-CN')}
            </p>
          </div>
        </div>
      </div>
      
      {/* 任务提交记录 */}
      <div>
        <h2 className="text-xl font-bold text-gray-900 mb-4">
          任务提交记录
        </h2>
        
        {teacher.taskSubmissions.length === 0 ? (
          <div className="card text-center py-12">
            <div className="text-4xl mb-2">📝</div>
            <p className="text-gray-600">
              该老师还没有提交任何任务
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {teacher.taskSubmissions.map(submission => {
              const task = TASKS_CONFIG[submission.taskIndex]
              if (!task) return null
              
              return (
                <div key={submission.id} className="card">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <span className="text-3xl">{task.emoji}</span>
                      <div>
                        <h3 className="font-semibold text-gray-900">
                          {task.title}
                        </h3>
                        <p className="text-sm text-gray-600">
                          任务 {task.index} · {task.type}
                        </p>
                      </div>
                    </div>
                    <span className={`badge ${
                      submission.status === 'COMPLETED' ? 'badge-success' :
                      submission.status === 'PENDING_FEEDBACK' ? 'badge-warning' :
                      submission.status === 'NEEDS_REVISION' ? 'badge-warning' :
                      'badge-gray'
                    }`}>
                      {getTaskStatusText(submission.status)}
                    </span>
                  </div>
                  
                  {/* 提交内容预览 */}
                  <div className="mb-3">
                    {submission.formData && (
                      <div className="p-3 bg-gray-50 rounded text-sm">
                        <pre className="text-gray-700 whitespace-pre-wrap">
                          {JSON.stringify(submission.formData, null, 2)}
                        </pre>
                      </div>
                    )}
                    
                    {submission.videoUrl && (
                      <div className="text-sm">
                        <a
                          href={submission.videoUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary-600 hover:text-primary-700"
                        >
                          查看视频 →
                        </a>
                      </div>
                    )}
                    
                    {submission.textContent && (
                      <div className="p-3 bg-gray-50 rounded text-sm text-gray-700 whitespace-pre-wrap">
                        {submission.textContent}
                      </div>
                    )}
                  </div>
                  
                  {/* 反馈 */}
                  {submission.feedback && (
                    <div className="p-3 bg-blue-50 border-l-4 border-blue-500 rounded text-sm">
                      <p className="font-medium text-blue-900 mb-1">反馈:</p>
                      <p className="text-blue-800">{submission.feedback}</p>
                    </div>
                  )}
                  
                  {/* 提交信息 */}
                  <div className="mt-3 pt-3 border-t border-gray-200 flex justify-between text-xs text-gray-500">
                    <span>
                      提交于: {new Date(submission.createdAt).toLocaleString('zh-CN')}
                    </span>
                    {submission.attemptCount > 1 && (
                      <span>第 {submission.attemptCount} 次提交</span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

