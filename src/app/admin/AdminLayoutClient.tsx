'use client'

import { usePathname } from 'next/navigation'
import LogoutButton from './LogoutButton'

interface MenuItem {
  path: string
  icon: string
  label: string
  roles: string[]
}

const MENU_ITEMS: MenuItem[] = [
  { path: '/admin/teachers', icon: '👨‍🏫', label: '老师管理', roles: ['super_admin'] },
  { path: '/admin/operators', icon: '👥', label: '运营人员', roles: ['super_admin'] },
  { path: '/admin/referrals', icon: '🤝', label: '邀请管理', roles: ['super_admin'] },
  { path: '/admin/withdrawals', icon: '💰', label: '提现管理', roles: ['super_admin'] },
  { path: '/admin/certificates', icon: '📄', label: '证明开具', roles: ['super_admin'] },
  { path: '/admin/case-image-records', icon: '📊', label: '案例记录', roles: ['super_admin'] },
  { path: '/admin/tencent-meetings', icon: '🎥', label: '会议管理', roles: ['super_admin'] },
  { path: '/admin/config', icon: '⚙️', label: '系统配置', roles: ['super_admin'] },
]

export default function AdminLayoutClient({
  children,
  role
}: {
  children: React.ReactNode
  role: string
}) {
  const pathname = usePathname()
  
  const isActive = (path: string) => {
    return pathname.startsWith(path)
  }
  
  const navLinkClass = (path: string) => {
    return `text-sm font-medium transition-colors pb-1 ${
      isActive(path)
        ? 'text-blue-600 border-b-2 border-blue-600'
        : 'text-gray-600 hover:text-gray-900'
    }`
  }
  
  // 根据角色过滤菜单项
  const visibleMenuItems = MENU_ITEMS.filter(item => item.roles.includes(role))
  
  return (
    <div className="min-h-screen bg-gray-50">
      {/* 顶部导航栏 */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <span className="text-2xl">🎓</span>
              <div>
                <h1 className="text-lg font-bold text-gray-900">
                  伴学管理后台
                </h1>
                <p className="text-xs text-gray-500">
                  Teacher Onboarding System
                </p>
              </div>
            </div>
            
            <nav className="flex items-center gap-6">
              {visibleMenuItems.map(item => (
                <a
                  key={item.path}
                  href={item.path}
                  className={`${navLinkClass(item.path)} inline-flex items-center gap-1 whitespace-nowrap`}
                >
                  <span aria-hidden>{item.icon}</span>
                  {item.label}
                </a>
              ))}
              <LogoutButton />
            </nav>
          </div>
        </div>
      </header>
      
      <main className="container mx-auto px-4 py-8">
        {children}
      </main>
    </div>
  )
}
