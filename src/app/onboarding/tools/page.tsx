import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import Link from 'next/link'

interface Tool {
  icon: string
  name: string
  description: string
  href?: string
  available: boolean
}

const TOOLS: Tool[] = [
  {
    icon: '📋',
    name: '规划书自查器',
    description: '依据上传的规划书，分析指出当前的问题和改进建议',
    href: '/onboarding/tools/planner-checker',
    available: true,
  },
  {
    icon: '🎉',
    name: '案例图片生成器',
    description: '选择喜报模板，上传案例截图并填写文案，一键生成案例图片',
    href: '/onboarding/tools/case-image-generator',
    available: true,
  },
  {
    icon: '🤖',
    name: '头像生成器',
    description: '依据上传的个人照片，生成伴学教练的微信头像',
    available: false,
  },
  {
    icon: '💬',
    name: '家长话术助手',
    description: '依据截图或对话内容，生成回复的建议内容',
    available: false,
  },
]

export default async function ToolsPage() {
  const cookieStore = await cookies()
  const teacherId = cookieStore.get('teacherId')?.value

  if (!teacherId) {
    redirect('/auth/login')
  }

  return (
    <div className="animate-fade-in">
      <div className="mb-8">
        <Link
          href="/onboarding"
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 transition-colors mb-4"
        >
          ← 返回引导页
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">常用工具</h1>
        <p className="text-gray-600">这里提供一些帮助你提升工作效率的实用工具</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {TOOLS.map((tool) => {
          const card = (
            <div
              className={`
                relative flex flex-col items-start p-6 rounded-2xl border-2 transition-all
                ${tool.available
                  ? 'border-indigo-200 bg-white hover:border-indigo-400 hover:shadow-lg cursor-pointer'
                  : 'border-gray-100 bg-gray-50 cursor-not-allowed opacity-70'
                }
              `}
            >
              {!tool.available && (
                <span className="absolute top-3 right-3 text-xs font-medium px-2 py-0.5 rounded-full bg-gray-200 text-gray-500">
                  即将上线
                </span>
              )}
              {tool.available && (
                <span className="absolute top-3 right-3 text-xs font-medium px-2 py-0.5 rounded-full bg-green-100 text-green-700">
                  可使用
                </span>
              )}
              <div className="text-5xl mb-4">{tool.icon}</div>
              <h2 className="text-lg font-semibold text-gray-900 mb-2">{tool.name}</h2>
              <p className="text-sm text-gray-500 leading-relaxed">{tool.description}</p>
              {tool.available && (
                <div className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-indigo-600">
                  立即使用 →
                </div>
              )}
            </div>
          )

          return tool.available && tool.href ? (
            <Link key={tool.name} href={tool.href}>
              {card}
            </Link>
          ) : (
            <div key={tool.name}>{card}</div>
          )
        })}
      </div>
    </div>
  )
}
