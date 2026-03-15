'use client'

import { usePathname, useRouter } from 'next/navigation'

interface MenuItem {
  path: string
  label: string
}

const MENU_ITEMS: MenuItem[] = [
  { path: '/admin/teachers', label: '老师管理' },
  { path: '/operator/team', label: '团队人员管理' },
  { path: '/operator/planner-review', label: '规划师审核' },
  { path: '/operator/settings', label: '资料设置' },
]

export default function OperatorLayoutClient({
  children,
  operatorName,
}: {
  children: React.ReactNode
  operatorName: string
}) {
  const pathname = usePathname()
  const router = useRouter()

  const isActive = (path: string) => {
    if (path === '/admin/teachers') {
      return pathname.startsWith('/admin/teachers')
    }
    return pathname.startsWith(path)
  }

  const navLinkClass = (path: string) =>
    `text-sm font-medium transition-colors pb-1 ${
      isActive(path)
        ? 'text-blue-600 border-b-2 border-blue-600'
        : 'text-gray-600 hover:text-gray-900'
    }`

  async function handleLogout() {
    await fetch('/api/operator/logout', { method: 'POST' })
    router.push('/operator/login')
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <span className="text-2xl">🎓</span>
              <div>
                <h1 className="text-lg font-bold text-gray-900">伴学管理后台</h1>
                <p className="text-xs text-gray-500">学管：{operatorName}</p>
              </div>
            </div>

            <nav className="flex items-center gap-6">
              {MENU_ITEMS.map((item) => (
                <a key={item.path} href={item.path} className={navLinkClass(item.path)}>
                  {item.label}
                </a>
              ))}
              <button
                onClick={handleLogout}
                className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
              >
                退出
              </button>
            </nav>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">{children}</main>
    </div>
  )
}
