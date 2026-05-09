import { notFound } from 'next/navigation'
import { getReferralById } from '@/app/actions/referral'
import Link from 'next/link'
import ReferralDetailClient from './ReferralDetailClient'
import { formatDateTime } from '@/lib/utils'

export const dynamic = 'force-dynamic'

export default async function ReferralDetailPage({
  params
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const result = await getReferralById(id)
  
  if (!result.success || !result.referral) {
    notFound()
  }
  
  const { referral, indirectReferrer, indirectReferral } = result
  
  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* 页面标题 */}
      <div className="mb-6">
        <Link
          href="/admin/referrals"
          className="text-primary-600 hover:text-primary-700 text-sm mb-2 inline-block"
        >
          ← 返回邀请列表
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">邀请记录详情</h1>
      </div>
      
      {/* 邀请关系链（如果存在间接邀请） */}
      {indirectReferrer && (
        <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg shadow-md p-6 mb-6 border-2 border-blue-200">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">🔗 邀请关系链</h2>
          
          <div className="flex items-center justify-between gap-4 flex-wrap">
            {/* A - 间接邀请人 */}
            <div className="flex-1 min-w-[200px] bg-white rounded-lg p-4 border-2 border-purple-300 shadow">
              <div className="text-xs text-purple-600 font-semibold mb-2">👤 间接邀请人 (A)</div>
              <div className="font-bold text-gray-900 mb-1">{indirectReferrer.name || '未填写'}</div>
              <div className="text-sm text-gray-600">{indirectReferrer.phone || '未填写'}</div>
              <div className="text-xs text-gray-500 mt-2">邀请码: {indirectReferrer.inviteCode}</div>
              {indirectReferral && (
                <div className="mt-2">
                  {indirectReferral.status === 'VALID' ? (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-success-100 text-success-800">
                      ✅ 有效邀请
                    </span>
                  ) : indirectReferral.status === 'PENDING' ? (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
                      ⏳ 待审核
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                      ❌ 无效
                    </span>
                  )}
                </div>
              )}
            </div>
            
            {/* 箭头 */}
            <div className="flex flex-col items-center">
              <div className="text-2xl text-blue-500">→</div>
              <div className="text-xs text-gray-500 mt-1">邀请</div>
            </div>
            
            {/* B - 直接邀请人 */}
            <div className="flex-1 min-w-[200px] bg-white rounded-lg p-4 border-2 border-blue-300 shadow">
              <div className="text-xs text-blue-600 font-semibold mb-2">👤 直接邀请人 (B)</div>
              <div className="font-bold text-gray-900 mb-1">{referral.referrer.name || '未填写'}</div>
              <div className="text-sm text-gray-600">{referral.referrer.phone || '未填写'}</div>
              <div className="text-xs text-gray-500 mt-2">邀请码: {referral.referrer.inviteCode}</div>
              <div className="mt-2">
                {referral.status === 'VALID' ? (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-success-100 text-success-800">
                    ✅ 有效邀请
                  </span>
                ) : referral.status === 'PENDING' ? (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
                    ⏳ 待审核
                  </span>
                ) : (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                    ❌ 无效
                  </span>
                )}
              </div>
            </div>
            
            {/* 箭头 */}
            <div className="flex flex-col items-center">
              <div className="text-2xl text-blue-500">→</div>
              <div className="text-xs text-gray-500 mt-1">邀请</div>
            </div>
            
            {/* C - 被邀请人 */}
            <div className="flex-1 min-w-[200px] bg-white rounded-lg p-4 border-2 border-green-300 shadow">
              <div className="text-xs text-green-600 font-semibold mb-2">👥 被邀请人 (C)</div>
              <div className="font-bold text-gray-900 mb-1">{referral.referred.name || '未填写'}</div>
              <div className="text-sm text-gray-600">{referral.referred.phone || '未填写'}</div>
              <div className="text-xs text-gray-500 mt-2">
                任务进度: {referral.referred.currentTaskIndex}/6
              </div>
              <div className="mt-2">
                {referral.referred.status === 'COMPLETED' || referral.referred.status === 'UNLOCKED' ? (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-success-100 text-success-800">
                    ✓ 已完成
                  </span>
                ) : (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                    进行中
                  </span>
                )}
              </div>
            </div>
          </div>
          
          <div className="mt-4 p-3 bg-blue-100 rounded-lg">
            <div className="text-sm text-blue-900">
              <strong>说明：</strong>
              {indirectReferrer.name || 'A'} 邀请了 {referral.referrer.name || 'B'}，
              {referral.referrer.name || 'B'} 又邀请了 {referral.referred.name || 'C'}，
              因此 {indirectReferrer.name || 'A'} 获得间接邀请奖励。
            </div>
          </div>
        </div>
      )}
      
      {/* 邀请人信息 */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">👤 邀请人信息 {!indirectReferrer && '(直接邀请)'}</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="text-sm text-gray-600">姓名</div>
            <div className="font-medium">{referral.referrer.name || '未填写'}</div>
          </div>
          <div>
            <div className="text-sm text-gray-600">手机号</div>
            <div className="font-medium">{referral.referrer.phone || '未填写'}</div>
          </div>
          <div>
            <div className="text-sm text-gray-600">邀请码</div>
            <div className="font-mono text-sm">{referral.referrer.inviteCode}</div>
          </div>
        </div>
      </div>
      
      {/* 被邀请人信息 */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">👥 被邀请人信息</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="text-sm text-gray-600">姓名</div>
            <div className="font-medium">{referral.referred.name || '未填写'}</div>
          </div>
          <div>
            <div className="text-sm text-gray-600">手机号</div>
            <div className="font-medium">{referral.referred.phone || '未填写'}</div>
          </div>
          <div>
            <div className="text-sm text-gray-600">当前阶段</div>
            <div className="font-medium">第 {referral.referred.currentPhase} 阶段</div>
          </div>
          <div>
            <div className="text-sm text-gray-600">任务进度</div>
            <div className="font-medium">第 {referral.referred.currentTaskIndex}/6 个任务</div>
          </div>
          <div>
            <div className="text-sm text-gray-600">完成状态</div>
            <div>
              {referral.referred.status === 'COMPLETED' || referral.referred.status === 'UNLOCKED' ? (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-success-100 text-success-800">
                  ✓ 已完成
                </span>
              ) : (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                  进行中
                </span>
              )}
            </div>
          </div>
          <div>
            <div className="text-sm text-gray-600">注册时间</div>
            <div className="text-sm">{formatDateTime(referral.referred.createdAt)}</div>
          </div>
        </div>
      </div>
      
      {/* 邀请状态 */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">📊 邀请状态</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="text-sm text-gray-600">邀请状态</div>
            <div className="mt-1">
              {referral.status === 'PENDING' ? (
                <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-amber-100 text-amber-800">
                  ⏳ 待审核
                </span>
              ) : referral.status === 'VALID' ? (
                <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-success-100 text-success-800">
                  ✅ 有效邀请
                </span>
              ) : (
                <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-red-100 text-red-800">
                  ❌ 无效邀请
                </span>
              )}
            </div>
          </div>
          <div>
            <div className="text-sm text-gray-600">奖励状态</div>
            <div className="mt-1">
              {referral.rewardSent ? (
                <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-success-100 text-success-800">
                  ✅ 已发放
                </span>
              ) : (
                <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-gray-100 text-gray-800">
                  ⏳ 待发放
                </span>
              )}
            </div>
          </div>
          <div>
            <div className="text-sm text-gray-600">邀请时间</div>
            <div className="text-sm">{formatDateTime(referral.createdAt)}</div>
          </div>
          <div>
            <div className="text-sm text-gray-600">最后更新</div>
            <div className="text-sm">{formatDateTime(referral.updatedAt)}</div>
          </div>
        </div>
        
        {/* 管理员备注 */}
        {referral.adminNote && (
          <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-lg">
            <div className="text-sm font-medium text-amber-900 mb-1">管理员备注</div>
            <div className="text-sm text-amber-800 whitespace-pre-wrap">{referral.adminNote}</div>
            {referral.reviewedBy && (
              <div className="text-xs text-amber-700 mt-2">
                审核人：{referral.reviewedBy} | 审核时间：{referral.reviewedAt ? formatDateTime(referral.reviewedAt) : '-'}
              </div>
            )}
          </div>
        )}
      </div>
      
      {/* 操作区域 */}
      <ReferralDetailClient referral={referral} />
      
      {/* 快捷链接 */}
      <div className="bg-gray-50 rounded-lg p-4 mt-6">
        <div className="text-sm text-gray-700 mb-2">快捷链接</div>
        <div className="flex gap-3">
          <Link
            href={`/admin/teachers/${referral.referrer.id}`}
            className="text-sm text-primary-600 hover:text-primary-700"
          >
            查看邀请人资料 →
          </Link>
          <Link
            href={`/admin/teachers/${referral.referred.id}`}
            className="text-sm text-primary-600 hover:text-primary-700"
          >
            查看被邀请人资料 →
          </Link>
        </div>
      </div>
    </div>
  )
}
