'use client'

import { useState, useEffect } from 'react'

const SUBJECT_LABELS: Record<string, string> = {
  MATH: '数学',
  PHYSICS: '物理',
  CHEMISTRY: '化学',
}

interface CompletionContentProps {
  teacherName: string | null
  teacherId: string
  totalTasks: number
  primarySubject: string | null
  inviterName: string | null
  teamLeaderName: string | null
}

export default function CompletionContent({
  teacherName,
  teacherId,
  totalTasks,
  primarySubject,
  inviterName,
  teamLeaderName,
}: CompletionContentProps) {
  const [copied, setCopied] = useState(false)
  const [groupQrUrl, setGroupQrUrl] = useState<string | null>(null)
  const [introCopied, setIntroCopied] = useState(false)

  const subjectLabel = primarySubject ? (SUBJECT_LABELS[primarySubject] ?? primarySubject) : '数学'

  const buildIntroText = () =>
    `大家好，我是刚完成伴学引导任务的伴学教练${teacherName ?? ''}。\n最擅长学科：${subjectLabel}\n伴学教练ID：${teacherId}\n邀请人：${inviterName ?? '无'}\n团队认领人：${teamLeaderName ?? '无'}\n\n很高兴加入伴学团队，后续请大家多多指导与支持！`

  const [introText, setIntroText] = useState(buildIntroText)

  useEffect(() => {
    fetch('/api/qrcode/url')
      .then((res) => res.json())
      .then((data) => {
        if (data.url) setGroupQrUrl(data.url)
      })
      .catch(() => {})
  }, [])

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
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="max-w-4xl w-full animate-fade-in">
        {/* 恭喜文案 */}
        <div className="card">
          <div className="flex items-center justify-center gap-6 mb-8">
            <div className="inline-block animate-bounce text-7xl">
              🎉
            </div>
            <div className="text-left">
              <h1 className="text-3xl font-bold text-gray-900 mb-2">
                恭喜你完成所有新手任务!
              </h1>
              <p className="text-lg text-gray-600">
                你已经成功解锁{' '}
                <span className="text-primary-600 font-semibold">数学伴学老师</span>
                {' '}身份
              </p>
            </div>
          </div>
          
          {/* 身份卡片 */}
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
          
          {/* 伴学教练ID高亮提醒 */}
          <div className="bg-amber-50 border-2 border-amber-400 rounded-xl p-6 mb-8 shadow-md">
            <div className="flex items-start gap-3 mb-4">
              <div className="text-2xl">⚠️</div>
              <div className="flex-1">
                <h3 className="text-lg font-bold text-amber-900 mb-1">请务必保存好您的伴学教练ID</h3>
                <p className="text-sm text-amber-800">此ID是您的唯一标识，请妥善保管，用于后续接单和身份验证</p>
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
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                      复制ID
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
          
          {/* 下一步 */}
          <div className="space-y-4">
            <h2 className="text-xl font-semibold text-gray-900">
              接下来你可以:
            </h2>

            <div className="grid gap-6 md:grid-cols-2">
              {/* 左：微信群二维码 */}
              <div className="flex flex-col items-center justify-center border-2 border-primary-400 rounded-xl p-6 bg-green-50">
                <div className="text-base font-semibold text-gray-800 mb-4">
                  扫码加入新手群，开启接单 👇
                </div>
                <div className="w-52 h-52 bg-white rounded-xl shadow flex items-center justify-center border border-gray-200 overflow-hidden">
                  {groupQrUrl ? (
                    <img src={groupQrUrl} alt="微信群二维码" className="w-full h-full object-contain" />
                  ) : (
                    <div className="text-gray-400 text-sm text-center px-4">二维码加载中…</div>
                  )}
                </div>
                <p className="mt-3 text-xs text-gray-500">微信扫一扫加入伴学新手群</p>
              </div>

              {/* 右：自我介绍文本框 */}
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
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
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
          </div>
        </div>
        
        {/* 欢迎语 */}
        <div className="mt-8 text-center">
          <p className="text-gray-600">
            期待在伴学的旅程中,看到你的精彩表现 🌟
          </p>
          <p className="text-sm text-gray-500 mt-2">
            💡 点击右上角"邀请有奖"按钮，邀请好友一起加入伴学团队
          </p>
        </div>
      </div>
    </div>
  )
}

