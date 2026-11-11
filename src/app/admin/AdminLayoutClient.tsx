'use client'

import { usePathname } from 'next/navigation'
import LogoutButton from './LogoutButton'
import DashboardHeader from '@/components/admin/DashboardHeader'

interface MenuItem {
  path: string
  icon: string
  label: string
  roles: string[]
}

const MENU_ITEMS: MenuItem[] = [
  { path: '/admin/teachers', icon: '👨‍🏫', label: '老师管理', roles: ['super_admin'] },
  { path: '/admin/teachers/info-change-requests', icon: '📝', label: '资料修改审核', roles: ['super_admin'] },
  { path: '/admin/operators', icon: '👥', label: '运营人员', roles: ['super_admin'] },
  { path: '/admin/referrals', icon: '🤝', label: '邀请管理', roles: ['super_admin'] },
  { path: '/admin/withdrawals', icon: '💰', label: '提现管理', roles: ['super_admin'] },
  { path: '/admin/certificates', icon: '📄', label: '证明开具', roles: ['super_admin'] },
  { path: '/admin/case-image-records', icon: '📊', label: '案例记录', roles: ['super_admin'] },
  { path: '/admin/student-certificate-records', icon: '🏅', label: '奖状记录', roles: ['super_admin'] },
  { path: '/admin/tencent-meetings', icon: '🎥', label: '会议管理', roles: ['super_admin'] },
  { path: '/admin/config', icon: '⚙️', label: '系统配置', roles: ['super_admin'] },
  { path: '/admin/audit', icon: '📋', label: '审计日志', roles: ['super_admin'] },
]

export default function AdminLayoutClient({
  children,
  role,
  accountMenu,
}: {
  children: React.ReactNode
  role: string
  accountMenu?: React.ReactNode
}) {
  const pathname = usePathname()
  
  // 根据角色过滤菜单项
  const visibleMenuItems = MENU_ITEMS.filter(item => item.roles.includes(role))
  const activeItem = visibleMenuItems
    .filter(item => pathname === item.path || pathname.startsWith(`${item.path}/`))
    .sort((a, b) => b.path.length - a.path.length)[0]
  
  return (
    <div className="min-h-screen bg-gray-50">
      <DashboardHeader
        home="/admin/teachers"
        subtitle="管理工作台"
        navigationLabel="管理后台导航"
        items={visibleMenuItems.map(item => ({ ...item, active: item.path === activeItem?.path }))}
        accountMenu={accountMenu || <LogoutButton />}
      />
      
      <main className="container mx-auto px-4 py-8">
        {children}
      </main>
    </div>
  )
}
