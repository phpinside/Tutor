import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import {
  getCoachReviewPoolConfig,
  getFinalReviewPoolConfig,
  updateCoachReviewPoolConfig,
  updateFinalReviewPoolConfig,
} from '@/app/actions/coachReviewConfigActions'
import WeightedPoolManager from './WeightedPoolManager'

export const dynamic = 'force-dynamic'

export default async function CoachReviewPoolPage() {
  const cookieStore = await cookies()
  const adminSession = cookieStore.get('admin_session')

  if (!adminSession) {
    redirect('/admin/login')
  }

  const [result, finalResult] = await Promise.all([getCoachReviewPoolConfig(), getFinalReviewPoolConfig()])

  if (!result.success || !result.operators) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800">加载配置失败</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-10">
      <WeightedPoolManager
        icon="🎲"
        title="教练初审随机分配池"
        description="当教练的邀请人链路无法解析出初审运营时（外部接口失败 / 无上级学管 / 无团队认领人），从此池按权重随机分配一个运营负责初审。"
        rules={[
          '默认全员等权参与（权重 1），可按需排除或自定义权重（如 A=5, B=3 → A 获得 5/8 概率）',
          '权重为 0 / 开关关闭 = 排除出初审分配',
          '学管与运营角色均可参与初审分配',
        ]}
        operators={result.operators ?? []}
        saveAction={updateCoachReviewPoolConfig}
      />
      <WeightedPoolManager
        icon="🎯"
        title="教练复审随机分配池"
        description="教练通过初审进入复审后，按此比例在生效的「运营」角色账号中随机指派一名复审人（自动排除初审人本人）。"
        rules={[
          '默认全员等权参与（权重 1），可按需排除或自定义权重',
          '仅「运营」角色参与复审分配，学管无复审权',
          '被指派的运营在「老师管理 → 待我复审」中处理；超管始终可复审任意单据',
        ]}
        operators={finalResult.operators ?? []}
        saveAction={updateFinalReviewPoolConfig}
      />
    </div>
  )
}
