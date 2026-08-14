import { prisma } from '@/lib/prisma'
import { getTaskConfigs, TASK_VIDEO_UPLOADS, TOTAL_TASK_COUNT } from '@/lib/config'
import { getTeacherStatusText, getTaskStatusText, formatDateTime } from '@/lib/utils'
import { generatePrivateUrl, generateVideoPrivateUrl, extractQiniuKey } from '@/lib/qiniu'
import { notFound } from 'next/navigation'
import { cookies } from 'next/headers'
import Link from 'next/link'
import SetInviterModal from './SetInviterModal'
import SetInviteeDefaultFollowerModal from './SetInviteeDefaultFollowerModal'
import TeacherInfoEditModal from './TeacherInfoEditModal'
import ResetTeacherPasswordModal from './ResetTeacherPasswordModal'
import TeacherPhoneRevealControl from './TeacherPhoneRevealControl'
import { getTeacherRemarks, updateTeacherFollower } from '@/app/actions/operatorActions'
import TeacherRemarkSection from '@/components/admin/TeacherRemarkSection'
import TeacherDirectReferralReview from './TeacherDirectReferralReview'
import CoachReviewPanel from './CoachReviewPanel'
import OperatorPickerModal from './OperatorPickerModal'
import { getCoachReviewForTeacher } from '@/app/actions/coachReview'
import {
  getLearningPlannerStatusBadgeClass,
  getLearningPlannerStatusText,
} from '@/lib/learningPlanner'

export const dynamic = 'force-dynamic'

async function getViewerInfo() {
  const cookieStore = await cookies()

  const operatorSession = cookieStore.get('operator_session')
  if (operatorSession) {
    try {
      const data = JSON.parse(operatorSession.value)
      if (data.operatorId) {
        return { id: data.operatorId as string, name: data.name as string, isSuperAdmin: false }
      }
    } catch {}
  }

  const adminSession = cookieStore.get('admin_session')
  let role = 'super_admin'
  if (adminSession) {
    try {
      const data = JSON.parse(adminSession.value)
      role = data.role || 'super_admin'
    } catch {}
  }

  return { id: null, name: '管理员', isSuperAdmin: role === 'super_admin' }
}

export default async function TeacherDetailPage({
  params
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  const [TASKS_CONFIG, viewerInfo] = await Promise.all([
    getTaskConfigs(),
    getViewerInfo(),
  ])

  const teacher = await prisma.teacher.findUnique({
    where: { id },
    include: {
      taskSubmissions: {
        orderBy: { taskIndex: 'asc' }
      },
      invitedBy: {
        select: { id: true, name: true, phone: true }
      },
      learningPlannerApplication: {
        include: {
          reviews: {
            include: {
              operator: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
            orderBy: {
              createdAt: 'desc',
            },
          },
        },
      },
      defaultInviteeFollowUp: {
        select: { id: true, name: true, phone: true },
      },
      teamAssignment: {
        include: {
          operator: {
            select: { id: true, name: true, phone: true },
          },
        },
      },
    }
  })

  if (!teacher) {
    notFound()
  }

  const [remarks, directReferralSnapshot, coachReviewResult] = await Promise.all([
    getTeacherRemarks(id),
    viewerInfo.id
      ? Promise.resolve(null)
      : prisma.referral.findFirst({
          where: {
            referredId: id,
            type: 'DIRECT',
          },
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            status: true,
            adminNote: true,
            reviewedAt: true,
            rewardSent: true,
            createdAt: true,
          },
        }),
    getCoachReviewForTeacher(id),
  ])

  const coachReview = coachReviewResult.success ? coachReviewResult.review : null

  const directReferralForReview = directReferralSnapshot
    ? {
        id: directReferralSnapshot.id,
        status: directReferralSnapshot.status,
        adminNote: directReferralSnapshot.adminNote,
        rewardSent: directReferralSnapshot.rewardSent,
        createdAtLabel: formatDateTime(directReferralSnapshot.createdAt),
        reviewedAtLabel: directReferralSnapshot.reviewedAt
          ? formatDateTime(directReferralSnapshot.reviewedAt)
          : null,
      }
    : null
  const learningPlannerPdfUrl = teacher.learningPlannerApplication
    ? generatePrivateUrl(extractQiniuKey(teacher.learningPlannerApplication.studyPlanPdfUrl))
    : null

  const phoneViewerKind: 'operator' | 'admin' = viewerInfo.id ? 'operator' : 'admin'
  const canRevealPhone = Boolean(viewerInfo.id || viewerInfo.isSuperAdmin)
  /** 运营账号有 operatorId；仅 admin_session 登录的管理员可看邀请审核 */
  const canViewInviteAudit = viewerInfo.id == null
  
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
          <div className="flex items-center gap-3 flex-wrap">
            <TeacherInfoEditModal teacherId={teacher.id} teacher={teacher} />
            {(viewerInfo.isSuperAdmin || viewerInfo.id) && (
              <ResetTeacherPasswordModal teacherId={teacher.id} teacherName={teacher.name} />
            )}
            {viewerInfo.isSuperAdmin && (
              <SetInviterModal
                teacherId={teacher.id}
                currentInviter={teacher.invitedBy}
              />
            )}
            {viewerInfo.isSuperAdmin && (
              <SetInviteeDefaultFollowerModal
                teacherId={teacher.id}
                currentDefaultFollowUp={teacher.defaultInviteeFollowUp}
              />
            )}
            <span className={`badge text-base ${
              teacher.status === 'UNLOCKED' ? 'badge-success' :
              teacher.status === 'COMPLETED' ? 'badge-primary' :
              'badge-gray'
            }`}>
              {getTeacherStatusText(teacher.status)}
            </span>
          </div>
        </div>
        
        {/* 基础信息 */}
        <div className="mb-6">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">基础信息</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
            <div>
              <p className="text-gray-500 mb-1">联系电话</p>
              <TeacherPhoneRevealControl
                teacherId={teacher.id}
                phone={teacher.phone}
                viewerKind={phoneViewerKind}
                canReveal={canRevealPhone}
              />
            </div>
            <div>
              <p className="text-gray-500 mb-1">性别</p>
              <p className="font-medium text-gray-900">{teacher.gender || '未填写'}</p>
            </div>
            <div>
              <p className="text-gray-500 mb-1">年龄</p>
              <p className="font-medium text-gray-900">{teacher.age != null ? teacher.age : '未填写'}</p>
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
            {/* 学科信息 */}
            <div>
              <p className="text-gray-500 mb-1">可教学科</p>
              <div className="font-medium text-gray-900">
                {teacher.subjects && teacher.subjects.length > 0 ? (
                  <div className="flex gap-1 flex-wrap">
                    {teacher.subjects.map((s: string) => {
                      const label = s === 'MATH' ? '数学' : s === 'PHYSICS' ? '物理' : s === 'CHEMISTRY' ? '化学' : s
                      return (
                        <span key={s} className="badge-primary text-xs">{label}</span>
                      )
                    })}
                  </div>
                ) : '未填写'}
              </div>
            </div>
            <div>
              <p className="text-gray-500 mb-1">最擅长学科</p>
              <p className="font-medium text-gray-900">
                {teacher.primarySubject
                  ? (teacher.primarySubject === 'MATH' ? '数学' :
                     teacher.primarySubject === 'PHYSICS' ? '物理' :
                     teacher.primarySubject === 'CHEMISTRY' ? '化学' :
                     teacher.primarySubject)
                  : '未填写'}
              </p>
            </div>
            <div>
              <p className="text-gray-500 mb-1">高考数学成绩</p>
              <p className="font-medium text-gray-900">{teacher.mathScore ? `${teacher.mathScore}分` : '未填写'}</p>
            </div>
            <div>
              <p className="text-gray-500 mb-1">高考物理成绩</p>
              <p className="font-medium text-gray-900">{teacher.physicsScore ? `${teacher.physicsScore}分` : '未填写'}</p>
            </div>
            <div>
              <p className="text-gray-500 mb-1">高考化学成绩</p>
              <p className="font-medium text-gray-900">{teacher.chemistryScore ? `${teacher.chemistryScore}分` : '未填写'}</p>
            </div>
            <div>
              <p className="text-gray-500 mb-1">数理化竞赛经历</p>
              <p className="font-medium text-gray-900">{teacher.scienceCompetition || teacher.mathCompetition || '未填写'}</p>
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
              <p className="font-medium text-gray-900">{teacher.currentTaskIndex} / {TOTAL_TASK_COUNT}</p>
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
            <div>
              <p className="text-gray-500 mb-1">邀请人</p>
              {teacher.invitedBy ? (
                <p className="font-medium text-gray-900">
                  {teacher.invitedBy.name || '未命名'} · {teacher.invitedBy.id}
                </p>
              ) : (
                <p className="font-medium text-gray-400">暂无</p>
              )}
            </div>
            <div>
              <p className="text-gray-500 mb-1">跟进人</p>
              <div className="flex items-center gap-2">
                {teacher.teamAssignment ? (
                  <p className="font-medium text-gray-900">
                    {teacher.teamAssignment.operator.name}
                    {teacher.teamAssignment.operator.phone && (
                      <span className="ml-1 text-gray-400 text-xs">{teacher.teamAssignment.operator.phone}</span>
                    )}
                  </p>
                ) : (
                  <p className="font-medium text-gray-400">暂无</p>
                )}
                {viewerInfo.isSuperAdmin && (
                  <OperatorPickerModal
                    triggerLabel="修改"
                    title="修改跟进人"
                    currentOperator={
                      teacher.teamAssignment
                        ? {
                            id: teacher.teamAssignment.operator.id,
                            name: teacher.teamAssignment.operator.name,
                            phone: teacher.teamAssignment.operator.phone,
                          }
                        : null
                    }
                    currentLabel="当前跟进人"
                    emptyLabel="当前无跟进人"
                    allowClear
                    clearLabel="移除跟进人"
                    clearSuccessMessage="已移除跟进人"
                    onSubmit={updateTeacherFollower.bind(null, teacher.id)}
                    successMessage={(name) => `已将跟进人设置为：${name}`}
                    buttonClassName="px-2 py-0.5 text-xs font-medium text-teal-700 bg-teal-50 rounded hover:bg-teal-100 transition-colors"
                  />
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {teacher.learningPlannerApplication && (
        <div className="card mb-8">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between mb-6">
            <div>
              <h2 className="text-xl font-bold text-gray-900">学习规划师认证申请</h2>
              <p className="text-sm text-gray-600 mt-1">
                提交于 {formatDateTime(teacher.learningPlannerApplication.submittedAt)}
              </p>
            </div>
            <span className={`badge text-sm ${getLearningPlannerStatusBadgeClass(teacher.learningPlannerApplication.status)}`}>
              {getLearningPlannerStatusText(teacher.learningPlannerApplication.status)}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm mb-6">
            <div>
              <p className="text-gray-500 mb-1">通过计数</p>
              <p className="font-medium text-gray-900">
                {teacher.learningPlannerApplication.approveCount}
              </p>
            </div>
            <div>
              <p className="text-gray-500 mb-1">不通过计数</p>
              <p className="font-medium text-gray-900">
                {teacher.learningPlannerApplication.rejectCount}
              </p>
            </div>
            <div>
              <p className="text-gray-500 mb-1">审核时间</p>
              <p className="font-medium text-gray-900">
                {teacher.learningPlannerApplication.finalReviewedAt
                  ? formatDateTime(teacher.learningPlannerApplication.finalReviewedAt)
                  : '待终审'}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6 text-sm">
            <div>
              <p className="text-gray-500 mb-2">学习规划书</p>
              {learningPlannerPdfUrl ? (
                <a
                  href={learningPlannerPdfUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary-600 hover:text-primary-700 font-medium"
                >
                  {teacher.learningPlannerApplication.studyPlanPdfName}
                </a>
              ) : (
                <p className="text-gray-400">暂无</p>
              )}
            </div>
            <div>
              <p className="text-gray-500 mb-2">试听课录像</p>
              <a
                href={teacher.learningPlannerApplication.trialLessonVideoUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary-600 hover:text-primary-700 font-medium break-all"
              >
                查看录像链接
              </a>
            </div>
          </div>

          <div className="mb-6">
            <p className="text-gray-500 mb-2 text-sm">申请陈述</p>
            <div className="rounded-lg bg-gray-50 p-4 text-sm text-gray-700 whitespace-pre-wrap">
              {teacher.learningPlannerApplication.statement}
            </div>
          </div>

          {teacher.learningPlannerApplication.finalDecisionNote && (
            <div className="mb-6">
              <p className="text-gray-500 mb-2 text-sm">评委老师意见</p>
              <div className="rounded-lg bg-red-50 border border-red-100 p-4 text-sm text-gray-700 whitespace-pre-wrap">
                {teacher.learningPlannerApplication.finalDecisionNote}
              </div>
            </div>
          )}

          <div>
            <p className="text-gray-500 mb-3 text-sm">审核记录</p>
            {teacher.learningPlannerApplication.reviews.length === 0 ? (
              <p className="text-sm text-gray-400">暂无审核记录</p>
            ) : (
              <div className="space-y-3">
                {teacher.learningPlannerApplication.reviews.map((review) => (
                  <div key={review.id} className="rounded-lg border border-gray-200 p-4">
                    <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                      <div className="flex items-center gap-3">
                        <span
                          className={`badge text-xs ${
                            review.decision === 'APPROVED'
                              ? 'badge-success'
                              : 'bg-red-100 text-red-700'
                          }`}
                        >
                          {review.decision === 'APPROVED' ? '通过' : '不通过'}
                        </span>
                        <span className="text-sm font-medium text-gray-900">
                          {review.operator.name}
                        </span>
                      </div>
                      <span className="text-xs text-gray-500">
                        {formatDateTime(review.createdAt)}
                      </span>
                    </div>
                    {review.reason && (
                      <p className="mt-3 text-sm text-gray-700 whitespace-pre-wrap">
                        {review.reason}
                      </p>
                    )}
                    {review.imageUrls.length > 0 && (
                      <div className="mt-3 grid grid-cols-3 gap-2">
                        {review.imageUrls.map((url, idx) => {
                          const signedUrl = generatePrivateUrl(extractQiniuKey(url))
                          return (
                            <a key={idx} href={signedUrl} target="_blank" rel="noopener noreferrer">
                              <img
                                src={signedUrl}
                                alt={`问题截图 ${idx + 1}`}
                                className="w-full aspect-square object-cover rounded-lg border border-gray-200 hover:opacity-80 transition-opacity"
                              />
                            </a>
                          )
                        })}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
      
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
                    signedVideoUrls[config.key] = generateVideoPrivateUrl(extractKey(formData[urlKey]))
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
                    ) : submission.taskType === 'ONLINE_TEST' && submission.formData ? (
                      /* 在线测试数据：展示分数 */
                      <div className="p-3 bg-gray-50 rounded text-sm space-y-2">
                        {(() => {
                          const data = submission.formData as { score?: number; answers?: Record<string, string[]> }
                          const score = data.score
                          const answerCount = data.answers ? Object.keys(data.answers).length : 0
                          return (
                            <>
                              <div className="flex items-center gap-3">
                                <span className="font-medium text-gray-700">测试得分：</span>
                                <span className={`text-2xl font-bold ${
                                  score === undefined ? 'text-gray-400' :
                                  score >= 90 ? 'text-green-600' :
                                  score >= 60 ? 'text-yellow-600' :
                                  'text-red-600'
                                }`}>
                                  {score !== undefined ? `${score} 分` : '暂无'}
                                </span>
                              </div>
                              {answerCount > 0 && (
                                <div className="text-gray-500">
                                  共作答 {answerCount} 道题
                                </div>
                              )}
                            </>
                          )
                        })()}
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

      {coachReview ? (
        <CoachReviewPanel
          review={coachReview}
          viewer={{
            operatorId: viewerInfo.id,
            isSuperAdmin: viewerInfo.isSuperAdmin,
          }}
        />
      ) : canViewInviteAudit ? (
        <TeacherDirectReferralReview directReferral={directReferralForReview} />
      ) : null}

      {/* 备注日志 */}
      <TeacherRemarkSection
        teacherId={id}
        viewerId={viewerInfo.id}
        viewerName={viewerInfo.name}
        initialRemarks={remarks}
      />
    </div>
  )
}

