'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'

const SUBJECT_LABELS: Record<string, string> = {
  MATH: '数学',
  PHYSICS: '物理',
  CHEMISTRY: '化学',
}

const FEISHU_RULES_WIKI_URL =
  'https://fn73lnaiyt.feishu.cn/wiki/LqlAwVa9ti37SgkZKI5cxr6knkf?fromScene=spaceOverview'

export interface TaskSummaryForCompletion {
  index: number
  title: string
  emoji: string
  submissionStatus: string | null
}

export interface CoachReviewStatus {
  stage: string | null
  firstReviewVerdict: string | null
  firstReviewOperatorName: string | null
  hasFirstReviewer: boolean
}

interface CompletionContentProps {
  teacherName: string | null
  teacherId: string
  totalTasks: number
  primarySubject: string | null
  inviterName: string | null
  teamLeaderName: string | null
  taskSummaries: TaskSummaryForCompletion[]
  inviteApproved: boolean
  profileTaskHref: string
  coachReviewStatus: CoachReviewStatus
}

export default function CompletionContent({
  teacherName,
  teacherId,
  totalTasks,
  primarySubject,
  inviterName,
  teamLeaderName,
  taskSummaries,
  inviteApproved,
  profileTaskHref,
  coachReviewStatus,
}: CompletionContentProps) {
  const router = useRouter()
  const [copied, setCopied] = useState(false)
  const [groupQrUrl, setGroupQrUrl] = useState<string | null>(null)
  const [introCopied, setIntroCopied] = useState(false)

  const subjectLabel = primarySubject ? (SUBJECT_LABELS[primarySubject] ?? primarySubject) : '数学'

  // 审核状态推导
  // 待审核页：判断是"待学管初审"还是"待管理员审核"
  // 仅当 CoachReview 明确分配了初审负责人时才显示"待初审"，
  // 否则（合并审核 / 无审核记录）显示"待管理员审核"
  const isWaitingFirstReview =
    coachReviewStatus.stage === 'FIRST_REVIEW' &&
    coachReviewStatus.hasFirstReviewer &&
    coachReviewStatus.firstReviewVerdict === 'PENDING'

  // 成功页：判断学管归属
  // 优先使用初审负责人（通过学管初审并最终通过的情况）；
  // 若无（合并审核通过 / 无审核记录），回退到团队认领人（teamLeaderName）
  const assignedManagerName =
    (coachReviewStatus.firstReviewVerdict === 'APPROVED'
      ? coachReviewStatus.firstReviewOperatorName
      : null) ?? teamLeaderName ?? null

  const buildIntroText = () =>
    `大家好，我是刚完成伴学引导任务的伴学教练${teacherName ?? ''}。\n最擅长学科：${subjectLabel}\n伴学教练ID：${teacherId}\n邀请人：${inviterName ?? '无'}\n团队认领人：${teamLeaderName ?? '无'}\n\n很高兴加入伴学团队，后续请大家多多指导与支持！`

  const [introText, setIntroText] = useState(buildIntroText)

  useEffect(() => {
    if (!inviteApproved) return
    fetch('/api/qrcode/url')
      .then((res) => res.json())
      .then((data) => {
        if (data.url) setGroupQrUrl(data.url)
      })
      .catch(() => {})
  }, [inviteApproved])

  const handleCopyId = () => {
    navigator.clipboard.writeText(teacherId)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleCopyIntro = () => {
    navigator.clipboard.writeText(introText)
    setIntroCopied(true)
    setTimeout(() => setIntroCopied(false), 2000)
  }

  return (
    <div
      className={
        inviteApproved
          ? 'min-h-screen flex items-center justify-center px-4 py-8'
          : 'min-h-screen flex items-start justify-center px-4 pt-6 sm:pt-10 pb-12'
      }
    >
      <div className="max-w-4xl w-full animate-fade-in">
        {!inviteApproved ? (
          <div className="card">
            <div className="text-center mb-6">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-primary-100 text-2xl mb-3">
                ⏳
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-3">资料已提交，审核中</h1>

              {/* 审核阶段状态标识 */}
              <div className="flex justify-center mb-4">
                {isWaitingFirstReview ? (
                  <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-amber-50 border border-amber-200">
                    <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                    <span className="text-sm font-semibold text-amber-800">
                      待初审
                    </span>
                    <span className="text-sm text-amber-700">
                      （初审负责人：{coachReviewStatus.firstReviewOperatorName ?? '未知'}学管）
                    </span>
                  </div>
                ) : (
                  <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-indigo-50 border border-indigo-200">
                    <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
                    <span className="text-sm font-semibold text-indigo-800">
                      待管理员审核
                    </span>
                  </div>
                )}
              </div>

              <div className="text-left max-w-xl mx-auto space-y-3 text-gray-600 text-base leading-relaxed">
                <p>我们已经收到您的资料，预计将在3个工作日内完成审核，请您耐心等待。</p>
                <p>
                  审核通过后，您将正式解锁「
                  <span className="text-primary-600 font-semibold">{subjectLabel}伴学教练</span>
                  」身份 🎉
                </p>
              </div>
            </div>

            <div className="rounded-xl border border-gray-200 bg-gray-50/80 p-5 mb-6">
              <p className="text-sm font-semibold text-gray-900 mb-3">在此期间，您可以：</p>
              <ul className="space-y-3 text-sm text-gray-700 list-disc list-inside">
                <li>
                  <Link
                    href={profileTaskHref}
                    className="text-primary-600 font-medium hover:underline underline-offset-2"
                  >
                    完善个人信息
                  </Link>
                  ，提高通过率
                </li>
                <li>
                  熟悉平台规则与教学流程：
                  <a
                    href={FEISHU_RULES_WIKI_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary-600 font-medium hover:underline underline-offset-2 break-all"
                  >
                    伴学师手册V2.0版本
                  </a>
                </li>
              </ul>
            </div>

            <p className="text-center text-sm text-gray-500 mb-4">
              如有问题，欢迎随时联系您的推荐人获得支持
            </p>

            <p className="text-center text-xs text-gray-500 mb-3">
              审核完成后请刷新本页查看解锁结果。
            </p>
            <div className="flex justify-center">
              <button
                type="button"
                onClick={() => router.refresh()}
                className="px-5 py-2.5 rounded-lg bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium transition-colors"
              >
                刷新状态
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="card">
              <div className="flex items-center justify-center gap-6 mb-8">
                <div className="inline-block animate-bounce text-7xl">🎉</div>
                <div className="text-left">
                  <h1 className="text-3xl font-bold text-gray-900 mb-2">恭喜你完成所有新手任务!</h1>
                  <p className="text-lg text-gray-600">
                    你已经成功解锁{' '}
                    <span className="text-primary-600 font-semibold">{subjectLabel}伴学老师</span> 身份
                  </p>
                </div>
              </div>

              <div className="bg-gradient-to-br from-primary-500 to-indigo-600 rounded-xl p-8 text-white mb-8 shadow-lg">
                <div className="flex items-center justify-center gap-4 mb-4">
                  <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center text-3xl">
                    🎓
                  </div>
                  <div className="text-left">
                    <p className="text-sm opacity-90">认证伴学老师</p>
                    <p className="text-2xl font-bold">{teacherName || '新老师'}</p>
                  </div>
                </div>
                <div className="flex justify-around text-center mt-6 pt-6 border-t border-white/20">
                  <div>
                    <p className="text-3xl font-bold">✓</p>
                    <p className="text-xs opacity-90 mt-1">已完成培训</p>
                  </div>
                  <div>
                    <p className="text-3xl font-bold">{totalTasks}</p>
                    <p className="text-xs opacity-90 mt-1">完成任务</p>
                  </div>
                  <div>
                    <p className="text-3xl font-bold">🚀</p>
                    <p className="text-xs opacity-90 mt-1">准备就绪</p>
                  </div>
                </div>
              </div>

              <div className="bg-amber-50 border-2 border-amber-400 rounded-xl p-6 mb-8 shadow-md">
                <div className="flex items-start gap-3 mb-4">
                  <div className="text-2xl">⚠️</div>
                  <div className="flex-1">
                    <h3 className="text-lg font-bold text-amber-900 mb-1">请务必保存好您的伴学教练ID</h3>
                    <p className="text-sm text-amber-800">
                      此ID是您的唯一标识，请妥善保管，用于后续接单和身份验证
                    </p>
                  </div>
                </div>
                <div className="bg-white rounded-lg p-4 border-2 border-amber-300">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                    <div className="min-w-0 flex-1">
                      <p className="text-xs text-gray-600 mb-1">您的伴学教练ID</p>
                      <p className="text-lg sm:text-2xl font-bold text-gray-900 font-mono tracking-wide sm:tracking-wider break-all">
                        {teacherId}
                      </p>
                    </div>
                    <button
                      onClick={handleCopyId}
                      className="shrink-0 self-start sm:self-center px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg transition-colors flex items-center gap-2 font-medium"
                    >
                      {copied ? (
                        <>
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          已复制
                        </>
                      ) : (
                        <>
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                            />
                          </svg>
                          复制ID
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>

              <div className="mb-8 rounded-xl border border-gray-200 bg-gray-50/80 p-5">
                <h2 className="text-lg font-semibold text-gray-900 mb-1">回顾新手任务</h2>
                <p className="text-sm text-gray-600 mb-4">
                  可随时点击进入对应步骤查看或修改内容（与引导首页一致，支持修改后重新提交）
                </p>
                <div className="flex flex-wrap gap-2">
                  {taskSummaries.map((task) => (
                    <Link
                      key={task.index}
                      href={`/onboarding/task/${task.index}`}
                      className="inline-flex items-center gap-2 px-3 py-2 bg-success-50 border border-success-200 text-success-700 rounded-lg text-sm hover:bg-success-100 transition-colors"
                    >
                      <span>{task.emoji}</span>
                      <span className="font-medium">{task.title}</span>
                      {task.submissionStatus === 'COMPLETED' && <span className="text-success-600">✓</span>}
                      {task.submissionStatus === 'PENDING_FEEDBACK' && <span className="text-warning-600">⏳</span>}
                    </Link>
                  ))}
                </div>
              </div>

              <div className="space-y-4">
                <h2 className="text-xl font-semibold text-gray-900">接下来你可以:</h2>

                {/* 初筛通过提示与下一步指引 */}
                <div className="rounded-xl border-2 border-amber-300 bg-amber-50 p-5 shadow-sm">
                  <div className="flex items-start gap-3">
                    <span className="text-2xl shrink-0">🎊</span>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-base font-bold text-amber-900 mb-2">
                        恭喜您通过了伴学师初筛！
                      </h3>
                      <p className="text-sm text-amber-800 leading-relaxed mb-3">
                        下一步请您入群后根据群公告完成学管的复试工作。
                      </p>
                      <div className="rounded-lg bg-white/70 border border-amber-200 p-3">
                        <p className="text-sm text-amber-900 leading-relaxed">
                          <span className="font-semibold">⚠️ 注册EDU系统时，请注意您所使用的手机号：</span>
                          您所使用的手机号必须能注册企业微信，且与注册EDU时使用的手机号一致。
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid gap-6 md:grid-cols-2">
                  <div className="flex flex-col items-center justify-center border-2 border-primary-400 rounded-xl p-6 bg-green-50">
                    <div className="text-base font-semibold text-gray-800 mb-4">扫码加入新手群，开启接单 👇</div>
                    <div className="w-52 h-52 bg-white rounded-xl shadow flex items-center justify-center border border-gray-200 overflow-hidden">
                      {groupQrUrl ? (
                        <img src={groupQrUrl} alt="微信群二维码" className="w-full h-full object-contain" />
                      ) : (
                        <div className="text-gray-400 text-sm text-center px-4">二维码加载中…</div>
                      )}
                    </div>
                    <p className="mt-3 text-xs text-gray-500">微信扫一扫加入伴学新手群(入群后请修改备注后真实姓名)</p>
                  </div>

                  <div className="flex flex-col">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm font-semibold text-gray-700">进群后发送以下自我介绍（可编辑）</p>
                      <button
                        onClick={handleCopyIntro}
                        className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg bg-primary-500 hover:bg-primary-600 text-white transition-colors"
                      >
                        {introCopied ? (
                          <>
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                            已复制
                          </>
                        ) : (
                          <>
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                              />
                            </svg>
                            复制文本
                          </>
                        )}
                      </button>
                    </div>
                    <textarea
                      value={introText}
                      onChange={(e) => setIntroText(e.target.value)}
                      rows={10}
                      className="flex-1 w-full rounded-xl border-2 border-gray-200 focus:border-primary-400 focus:outline-none p-4 text-sm text-gray-800 leading-relaxed resize-none bg-white"
                    />
                    <p className="mt-2 text-xs text-gray-400">内容已根据你的信息自动填写，可直接修改后复制发送</p>
                  </div>
                </div>

                {/* 学管信息提示 */}
                {assignedManagerName ? (
                  <div className="rounded-xl border-2 border-primary-300 bg-primary-50 p-5 shadow-sm">
                    <div className="flex items-start gap-3">
                      <span className="text-2xl shrink-0">🤝</span>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-base font-bold text-primary-900 mb-1">
                          您的学管是{assignedManagerName}老师
                        </h3>
                        <p className="text-sm text-primary-800 leading-relaxed">
                          请您进群后与她（他）联系，并获得进一步的指导。
                        </p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-xl border-2 border-amber-300 bg-amber-50 p-5 shadow-sm">
                    <div className="flex items-start gap-3">
                      <span className="text-2xl shrink-0">📋</span>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-base font-bold text-amber-900 mb-1">
                          您的学管当前待分配
                        </h3>
                        <p className="text-sm text-amber-800 leading-relaxed">
                          请进群后联系群主确定。
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                <div className="rounded-xl border-2 border-primary-200 bg-primary-50/80 p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">伴学规划师认证</h3>
                    <p className="text-sm text-gray-600 mt-1">
                      若你符合申请条件，可继续提交规划师认证，拓展伴学规划类服务
                    </p>
                  </div>
                  <Link
                    href="/onboarding/planner-certification"
                    className="shrink-0 inline-flex items-center justify-center px-5 py-2.5 rounded-lg bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium transition-colors"
                  >
                    前往规划师申请
                  </Link>
                </div>
              </div>
            </div>

            <div className="mt-8 text-center">
              <p className="text-gray-600">期待在伴学的旅程中,看到你的精彩表现 🌟</p>
              <p className="text-sm text-gray-500 mt-2">
                💡 点击右上角&quot;邀请有奖&quot;按钮，邀请好友一起加入伴学团队
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
