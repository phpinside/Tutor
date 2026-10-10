import Link from 'next/link'

export const IMAGE_TOOL_TABS = [
  {
    href: '/onboarding/tools/student-certificate',
    icon: '🏅',
    label: '学员奖状生成器',
    description: '为每一份努力留下荣誉。填写信息，实时预览，一键下载高清奖状图片。',
  },
  {
    href: '/onboarding/tools/case-image-generator',
    icon: '🎉',
    label: '案例图片生成器',
    description: '选择图片模板，上传案例截图并填写文案，生成可下载的喜报案例图。',
  },
] as const

type ImageToolHref = (typeof IMAGE_TOOL_TABS)[number]['href']

export default function ImageToolsTabHeader({ activeHref }: { activeHref: ImageToolHref }) {
  const activeTab = IMAGE_TOOL_TABS.find((tab) => tab.href === activeHref) ?? IMAGE_TOOL_TABS[0]

  return (
    <div className="mb-7">
      <Link
        href="/onboarding/tools"
        className="mb-4 inline-flex items-center gap-1 text-sm text-gray-500 transition-colors hover:text-gray-800"
      >
        ← 返回工具列表
      </Link>
      <h1 className="sr-only">{activeTab.label}</h1>
      <nav aria-label="图片工具切换" className="mb-4 flex w-full gap-2 rounded-2xl border border-gray-200 bg-gray-100 p-1.5 shadow-sm">
        {IMAGE_TOOL_TABS.map((tab) => {
          const isActive = tab.href === activeHref
          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={isActive ? 'page' : undefined}
              className={`flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-3 text-base font-semibold transition-all ${
                isActive
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'text-gray-500 hover:bg-white hover:text-gray-900'
              }`}
            >
              <span className="text-lg">{tab.icon}</span>
              {tab.label}
            </Link>
          )
        })}
      </nav>
      <p className="text-gray-600">{activeTab.description}</p>
    </div>
  )
}
