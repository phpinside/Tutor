import { prisma } from '@/lib/prisma'
import { getTaskConfigs, TASK_VIDEO_UPLOADS } from '@/lib/config'
import { getTeacherStatusText, getTaskStatusText, formatDateTime } from '@/lib/utils'
import { generatePrivateUrl } from '@/lib/qiniu'
import { notFound } from 'next/navigation'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

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
        
        {/* 基础信息 */}
        <div className="mb-6">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">基础信息</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
            <div>
              <p className="text-gray-500 mb-1">联系电话</p>
              <p className="font-medium text-gray-900">{teacher.phone || '未填写'}</p>
            </div>
            <div>
              <p className="text-gray-500 mb-1">性别</p>
              <p className="font-medium text-gray-900">{teacher.gender || '未填写'}</p>
            </div>
            <div>
              <p className="text-gray-500 mb-1">年龄</p>
              <p className="font-medium text-gray-900">{teacher.age || '未填写'}</p>
            </div>
            <div>
              <p className="text-gray-500 mb-1">学历/学校</p>
              <p className="font-medium text-gray-900">{teacher.school || '未填写'}</p>
            </div>
            <div>
              <p className="text-gray-500 mb-1">毕业年份</p>
              <p className="font-medium text-gray-900">{teacher.graduationYear || '未填写'}</p>
            </div>
            <div>
              <p className="text-gray-500 mb-1">身份</p>
              <p className="font-medium text-gray-900">{teacher.identity || '未填写'}</p>
            </div>
          </div>
        </div>
        
        {/* 教学能力 & 资质 */}
        <div className="mb-6">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">教学能力 & 资质</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
            <div>
              <p className="text-gray-500 mb-1">高考数学成绩</p>
              <p className="font-medium text-gray-900">{teacher.mathScore ? `${teacher.mathScore}分` : '未填写'}</p>
            </div>
            <div>
              <p className="text-gray-500 mb-1">数学竞赛经历</p>
              <p className="font-medium text-gray-900">{teacher.mathCompetition || '未填写'}</p>
            </div>
            <div>
              <p className="text-gray-500 mb-1">教学风格</p>
              <p className="font-medium text-gray-900">{teacher.teachingStyle || '未填写'}</p>
            </div>
            <div className="col-span-2 md:col-span-3">
              <p className="text-gray-500 mb-1">教学经验</p>
              <p className="font-medium text-gray-900">{teacher.teachingExperience || '未填写'}</p>
            </div>
            <div>
              <p className="text-gray-500 mb-1">可辅导学段</p>
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
              <p className="text-gray-500 mb-1">擅长方向</p>
              <div className="font-medium text-gray-900">
                {teacher.teachingStrengths ? (
                  <div className="flex gap-1 flex-wrap">
                    {teacher.teachingStrengths.split(',').map((strength, index) => (
                      <span key={index} className="badge-primary text-xs">
                        {strength.trim()}
                      </span>
                    ))}
                  </div>
                ) : (
                  '未填写'
                )}
              </div>
            </div>
            <div>
              <p className="text-gray-500 mb-1">擅长学生类型</p>
              <div className="font-medium text-gray-900">
                {teacher.studentTypes ? (
                  <div className="flex gap-1 flex-wrap">
                    {teacher.studentTypes.split(',').map((type, index) => (
                      <span key={index} className="badge-primary text-xs">
                        {type.trim()}
                      </span>
                    ))}
                  </div>
                ) : (
                  '未填写'
                )}
              </div>
            </div>
          </div>
        </div>
        
        {/* 可辅导时间 */}
        <div className="mb-6">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">可辅导时间</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div>
              <p className="text-gray-500 mb-1">周一到周五</p>
              <p className="font-medium text-gray-900">{teacher.weekdayTime || '未填写'}</p>
            </div>
            <div>
              <p className="text-gray-500 mb-1">周末</p>
              <p className="font-medium text-gray-900">{teacher.weekendTime || '未填写'}</p>
            </div>
            <div>
              <p className="text-gray-500 mb-1">寒暑假</p>
              <p className="font-medium text-gray-900">{teacher.holidayTime || '未填写'}</p>
            </div>
          </div>
        </div>
        
        {/* 系统信息 */}
        <div className="pt-4 border-t border-gray-200">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">系统信息</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
            <div>
              <p className="text-gray-500 mb-1">当前任务</p>
              <p className="font-medium text-gray-900">{teacher.currentTaskIndex} / 6</p>
            </div>
            <div>
              <p className="text-gray-500 mb-1">注册时间</p>
              <p className="font-medium text-gray-900">
                {formatDateTime(teacher.createdAt)}
              </p>
            </div>
            <div>
              <p className="text-gray-500 mb-1">最后更新</p>
              <p className="font-medium text-gray-900">
                {formatDateTime(teacher.updatedAt)}
              </p>
            </div>
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
              
              // Helper function to extract key from URL
              const extractKey = (videoUrl: string): string => {
                try {
                  const url = new URL(videoUrl)
                  return url.pathname.substring(1) // 去掉开头的 '/'
                } catch (e) {
                  // 如果不是完整 URL，直接当作 key 使用
                  return videoUrl
                }
              }
              
              // 为私有视频生成带签名的 URL（动态处理多个视频）
              const videoConfigs = TASK_VIDEO_UPLOADS[submission.taskIndex]
              const signedVideoUrls: Record<string, string> = {}
              
              if (videoConfigs && submission.formData && typeof submission.formData === 'object') {
                const formData = submission.formData as any
                videoConfigs.forEach(config => {
                  const urlKey = `${config.key}VideoUrl`
                  if (formData[urlKey]) {
                    signedVideoUrls[config.key] = generatePrivateUrl(extractKey(formData[urlKey]))
                  }
                })
              }
              
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
                    {/* 动态视频显示 */}
                    {videoConfigs && Object.keys(signedVideoUrls).length > 0 ? (
                      <div className="space-y-3">
                        {videoConfigs.map((config, index) => {
                          const signedUrl = signedVideoUrls[config.key]
                          if (!signedUrl) return null
                          
                          return (
                            <div key={config.key} className="space-y-1">
                              <div className="flex items-center gap-2">
                                {config.emoji && <span className="text-lg">{config.emoji}</span>}
                                <span className="text-sm font-medium text-gray-700">
                                  {videoConfigs.length > 1 && `视频${index + 1}: `}{config.title}
                                </span>
                              </div>
                              <a
                                href={signedUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-sm text-primary-600 hover:text-primary-700 ml-6"
                              >
                                查看视频 →
                              </a>
                            </div>
                          )
                        })}
                      </div>
                    ) : submission.taskType === 'TRAINING' && submission.formData ? (
                      /* 培训任务数据 */
                      <div className="p-3 bg-gray-50 rounded text-sm space-y-2">
                        <div className="flex items-center gap-2">
                          <span className="text-success-600">✓</span>
                          <span className="text-gray-700 font-medium">已确认完成培训</span>
                        </div>
                        {(submission.formData as any).watchedVideoCount !== undefined && (
                          <div className="text-gray-600 ml-6">
                            观看进度: {(submission.formData as any).watchedVideoCount} / {(submission.formData as any).totalVideoCount} 个视频
                          </div>
                        )}
                        {submission.watchProgress && (
                          <div className="text-gray-600 ml-6">
                            完成度: {submission.watchProgress}%
                          </div>
                        )}
                      </div>
                    ) : submission.formData && (submission.taskType === 'FORM' || submission.taskType === 'INFO') ? (
                      /* 表单类型数据 */
                      <div className="p-3 bg-gray-50 rounded text-sm">
                        <pre className="text-gray-700 whitespace-pre-wrap">
                          {JSON.stringify(submission.formData, null, 2)}
                        </pre>
                      </div>
                    ) : submission.textContent ? (
                      /* 文本内容 */
                      <div className="p-3 bg-gray-50 rounded text-sm text-gray-700 whitespace-pre-wrap">
                        {submission.textContent}
                      </div>
                    ) : (
                      <p className="text-sm text-gray-500">暂无提交内容</p>
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
                      提交于: {formatDateTime(submission.createdAt)}
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

