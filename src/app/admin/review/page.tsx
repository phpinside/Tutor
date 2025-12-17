import { getPendingReviews } from '@/app/actions/task'
import { getTaskConfigs } from '@/lib/config'
import ReviewForm from '@/components/admin/ReviewForm'
import { updateTaskStatus } from '@/app/actions/task'

export default async function AdminReviewPage() {
  const submissions = await getPendingReviews()
  const TASKS_CONFIG = await getTaskConfigs()
  
  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          任务审核
        </h1>
        <p className="text-gray-600">
          共 {submissions.length} 个任务待审核
        </p>
      </div>
      
      {submissions.length === 0 ? (
        <div className="card text-center py-12">
          <div className="text-6xl mb-4">✅</div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            暂无待审核任务
          </h2>
          <p className="text-gray-600">
            所有提交的任务都已处理完成
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {submissions.map(submission => {
            const task = TASKS_CONFIG[submission.taskIndex]
            if (!task) return null
            
            return (
              <div key={submission.id} className="card">
                {/* 任务头部 */}
                <div className="flex items-start justify-between mb-6 pb-6 border-b border-gray-200">
                  <div className="flex items-start gap-4">
                    <span className="text-4xl">{task.emoji}</span>
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-1">
                        {task.title}
                      </h3>
                      <div className="flex items-center gap-3 text-sm text-gray-600">
                        <span>老师: {submission.teacher.name || '未填写'}</span>
                        <span>•</span>
                        <span>提交于: {new Date(submission.createdAt).toLocaleString('zh-CN')}</span>
                        {submission.attemptCount > 1 && (
                          <>
                            <span>•</span>
                            <span className="text-warning-600">第 {submission.attemptCount} 次提交</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  <span className="badge-warning">待审核</span>
                </div>
                
                {/* 任务内容 */}
                <div className="mb-6">
                  <h4 className="text-sm font-semibold text-gray-700 mb-3">提交内容:</h4>
                  
                  {/* 表单类型 */}
                  {submission.taskType === 'FORM' && submission.formData && (
                    <div className="p-4 bg-gray-50 rounded-lg">
                      <pre className="text-sm text-gray-700 whitespace-pre-wrap">
                        {JSON.stringify(submission.formData, null, 2)}
                      </pre>
                    </div>
                  )}
                  
                  {/* 视频上传类型 */}
                  {(submission.taskType === 'VIDEO_UPLOAD' || submission.taskType === 'PRACTICE') && (
                    <div className="space-y-2">
                      <a
                        href={submission.videoUrl || '#'}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 text-primary-600 hover:text-primary-700"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        查看视频
                      </a>
                      <p className="text-sm text-gray-600">
                        {submission.videoUrl || '视频URL'}
                      </p>
                    </div>
                  )}
                  
                  {/* 文本模拟类型 */}
                  {submission.taskType === 'SIMULATION' && submission.textContent && (
                    <div className="p-4 bg-gray-50 rounded-lg border-l-4 border-primary-500">
                      <p className="text-sm text-gray-700 whitespace-pre-wrap">
                        {submission.textContent}
                      </p>
                    </div>
                  )}
                </div>
                
                {/* 审核表单 */}
                <ReviewForm
                  submissionId={submission.id}
                  teacherId={submission.teacherId}
                  taskIndex={submission.taskIndex}
                  updateAction={updateTaskStatus}
                />
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

