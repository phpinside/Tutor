import Link from 'next/link'
import { getDefaultRankingPeriod } from '@/lib/learning-manager-ranking'
import LearningManagerRankingClient from './LearningManagerRankingClient'

export const dynamic = 'force-dynamic'

export default function LearningManagerRankingPage() {
  return (
    <div>
      <Link href="/operator/tools" className="mb-4 inline-block text-sm text-gray-500 hover:text-blue-600">← 返回工具列表</Link>
      <h1 className="mb-2 text-3xl font-bold text-gray-900">学管榜单生成器</h1>
      <p className="mb-7 text-gray-600">填写时间区间和团队文案，实时预览并下载高清榜单图片。</p>
      <LearningManagerRankingClient defaultPeriod={getDefaultRankingPeriod()} />
    </div>
  )
}
