'use client'

import { useState } from 'react'
import Link from 'next/link'
import dynamic from 'next/dynamic'

const PosterGenerator = dynamic(() => import('@/components/referral/PosterGenerator'), {
  ssr: false
})

type ReferralData = {
  referrerName: string | null
  inviteCode: string | null
  stats: {
    total: number
    valid: number
    invalid: number
    rewardsSent: number
  }
  referrals: Array<{
    id: string
    index: number
    referredName: string
    currentPhase: number
    currentTaskIndex: number
    status: string
    referralStatus: 'VALID' | 'INVALID'
    rewardSent: boolean
    adminNote: string | null
    createdAt: Date
  }>
}

export default function ReferralDashboardClient({
  data,
  inviteUrl,
  viewUrl
}: {
  data: ReferralData
  inviteUrl: string
  viewUrl: string
}) {
  const { referrerName, inviteCode, stats, referrals } = data
  const [copiedType, setCopiedType] = useState<'invite' | 'view' | null>(null)
  const [showPosterGenerator, setShowPosterGenerator] = useState(false)

  const handleCopy = (text: string, type: 'invite' | 'view') => {
    navigator.clipboard.writeText(text)
    setCopiedType(type)
    setTimeout(() => setCopiedType(null), 2000)
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white py-8 px-4">
      <div className="max-w-6xl mx-auto">
        {/* 页面标题 */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            {referrerName ? `${referrerName}的邀请看板` : '我的邀请看板'}
          </h1>
          <p className="text-gray-600">
            邀请好友加入伴学团队，完成任务即可获得奖励
          </p>
        </div>
        
        {/* 邀请链接卡片 */}
        <div className="card mb-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">📤 分享邀请链接</h3>
          
          {/* 邀请链接 */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              邀请链接（分享给好友）
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={inviteUrl}
                readOnly
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 text-sm"
              />
              <button
                onClick={() => handleCopy(inviteUrl, 'invite')}
                className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-medium whitespace-nowrap"
              >
                {copiedType === 'invite' ? '✓ 已复制' : '复制链接'}
              </button>
            </div>
          </div>
          
          {/* 查看链接 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              专属查看链接（保存以便随时查看）
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={viewUrl}
                readOnly
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 text-sm"
              />
              <button
                onClick={() => handleCopy(viewUrl, 'view')}
                className="px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors font-medium whitespace-nowrap"
              >
                {copiedType === 'view' ? '✓ 已复制' : '复制链接'}
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              💡 保存此链接，随时在任何设备查看邀请记录
            </p>
          </div>

          {/* 生成邀请海报按钮 */}
          <div className="mt-6 pt-6 border-t border-gray-200">
            <button
              onClick={() => setShowPosterGenerator(true)}
              className="w-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-medium py-3 px-6 rounded-lg transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2"
            >
              <span className="text-xl">🎨</span>
              <span>生成邀请海报</span>
            </button>
            <p className="text-xs text-gray-500 mt-2 text-center">
              一键生成精美海报，分享到朋友圈更方便
            </p>
          </div>
        </div>
        
        {/* 统计卡片 */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="card text-center">
            <div className="text-3xl font-bold text-primary-600">{stats.total}</div>
            <div className="text-sm text-gray-600 mt-1">总邀请人数</div>
          </div>
          <div className="card text-center">
            <div className="text-3xl font-bold text-success-600">{stats.valid}</div>
            <div className="text-sm text-gray-600 mt-1">有效邀请</div>
          </div>
          <div className="card text-center">
            <div className="text-3xl font-bold text-warning-600">{stats.invalid}</div>
            <div className="text-sm text-gray-600 mt-1">无效邀请</div>
          </div>
          <div className="card text-center">
            <div className="text-3xl font-bold text-success-700">{stats.rewardsSent}</div>
            <div className="text-sm text-gray-600 mt-1">已发放奖励</div>
          </div>
        </div>
        
        {/* 被邀请人列表 */}
        <div className="card">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">👥 被邀请人列表</h3>
          
          {referrals.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-6xl mb-4">🎯</div>
              <p className="text-gray-600 mb-2">还没有人通过你的邀请加入</p>
              <p className="text-sm text-gray-500">快去分享你的邀请链接吧！</p>
            </div>
          ) : (
            <>
              {/* 桌面端表格 */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">序号</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">被邀请人</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">任务进度</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">完成状态</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">邀请状态</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">奖励状态</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">注册时间</th>
                    </tr>
                  </thead>
                  <tbody>
                    {referrals.map((referral) => (
                      <tr key={referral.id} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="py-3 px-4 text-sm">#{referral.index}</td>
                        <td className="py-3 px-4 text-sm font-medium">
                          被邀请人 #{referral.index}
                        </td>
                        <td className="py-3 px-4 text-sm">
                          第 {referral.currentTaskIndex}/6 个任务
                        </td>
                        <td className="py-3 px-4 text-sm">
                          {referral.status === 'COMPLETED' || referral.status === 'UNLOCKED' ? (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-success-100 text-success-800">
                              ✓ 已完成
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                              进行中
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-sm">
                          {referral.referralStatus === 'VALID' ? (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-success-100 text-success-800">
                              ✅ 有效
                            </span>
                          ) : (
                            <div className="group relative">
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-warning-100 text-warning-800 cursor-help">
                                ❌ 无效
                              </span>
                              {referral.adminNote && (
                                <div className="hidden group-hover:block absolute z-10 w-64 p-2 bg-gray-900 text-white text-xs rounded shadow-lg -top-2 left-full ml-2">
                                  原因：{referral.adminNote}
                                </div>
                              )}
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-4 text-sm">
                          {referral.rewardSent ? (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-success-100 text-success-800">
                              ✅ 已发放
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                              ⏳ 待发放
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-sm text-gray-600">
                          {new Date(referral.createdAt).toLocaleDateString('zh-CN')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              
              {/* 移动端卡片 */}
              <div className="md:hidden space-y-4">
                {referrals.map((referral) => (
                  <div key={referral.id} className="p-4 border border-gray-200 rounded-lg">
                    <div className="flex justify-between items-start mb-3">
                      <div className="font-medium text-gray-900">
                        被邀请人 #{referral.index}
                      </div>
                      <div className="flex gap-2">
                        {referral.referralStatus === 'VALID' ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-success-100 text-success-800">
                            ✅ 有效
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-warning-100 text-warning-800">
                            ❌ 无效
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="space-y-2 text-sm text-gray-600">
                      <div>进度：第 {referral.currentTaskIndex}/6 个任务</div>
                      <div>
                        状态：
                        {referral.status === 'COMPLETED' || referral.status === 'UNLOCKED' ? (
                          <span className="text-success-700 font-medium">✓ 已完成</span>
                        ) : (
                          <span className="text-blue-700 font-medium">进行中</span>
                        )}
                      </div>
                      <div>
                        奖励：
                        {referral.rewardSent ? (
                          <span className="text-success-700 font-medium">✅ 已发放</span>
                        ) : (
                          <span className="text-gray-700 font-medium">⏳ 待发放</span>
                        )}
                      </div>
                      <div className="text-xs">
                        注册：{new Date(referral.createdAt).toLocaleDateString('zh-CN')}
                      </div>
                      {referral.adminNote && referral.referralStatus === 'INVALID' && (
                        <div className="mt-2 p-2 bg-warning-50 border border-warning-200 rounded text-xs">
                          <strong>无效原因：</strong>{referral.adminNote}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
        
        {/* 返回首页链接 */}
        <div className="mt-6 text-center">
          <Link
            href="/onboarding"
            className="inline-flex items-center text-primary-600 hover:text-primary-700 font-medium"
          >
            ← 返回引导页面
          </Link>
        </div>
      </div>

      {/* 海报生成器 Modal */}
      {showPosterGenerator && (
        <PosterGenerator
          inviteUrl={inviteUrl}
          referrerName={referrerName}
          onClose={() => setShowPosterGenerator(false)}
        />
      )}
    </div>
  )
}
