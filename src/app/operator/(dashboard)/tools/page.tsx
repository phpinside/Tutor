import Link from 'next/link'

const TOOLS = [
  {
    name: '学管榜单生成器',
    icon: '🏆',
    description: '编辑时间区间和团队文案，生成蓝金风格的每周优秀学管榜单，下载高清图片。',
    href: '/operator/tools/learning-manager-ranking',
  },
]

export default function OperatorToolsPage() {
  return (
    <div>
      <h1 className="mb-2 text-3xl font-bold text-gray-900">在线工具</h1>
      <p className="mb-8 text-gray-600">为日常运营提供便捷的在线工具</p>
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {TOOLS.map((tool) => (
          <Link key={tool.href} href={tool.href} className="rounded-2xl border border-blue-200 bg-white p-6 transition hover:border-blue-400 hover:shadow-lg">
            <span className="mb-4 block text-4xl" aria-hidden="true">{tool.icon}</span>
            <h2 className="mb-2 text-lg font-semibold text-gray-900">{tool.name}</h2>
            <p className="text-sm leading-relaxed text-gray-500">{tool.description}</p>
            <span className="mt-5 inline-block text-sm font-medium text-blue-600">立即使用 →</span>
          </Link>
        ))}
      </div>
    </div>
  )
}
