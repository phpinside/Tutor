'use client'

import { usePathname, useSearchParams } from 'next/navigation'
import DashboardHeader from '@/components/admin/DashboardHeader'

interface MenuItem {
  path: string
  label: string
}

const MENU_ITEMS: MenuItem[] = [
  { path: '/admin/teachers', label: '老师管理' },
  { path: '/admin/teachers?inviteAudit=my_first_review', label: '教练审核' },
  { path: '/admin/teachers/info-change-requests', label: '资料修改审核' },
  { path: '/admin/tencent-meetings', label: '腾讯会议' },
  { path: '/operator/team', label: '团队人员管理' },
  { path: '/operator/planner-review', label: '规划师审核' },
  { path: '/operator/tools', label: '在线工具' },
  { path: '/operator/settings', label: '资料设置' },
]

export default function OperatorLayoutClient({
  children,
  operatorName,
  canManageGroupQr = false,
  accountMenu,
}: {
  children: React.ReactNode
  operatorName: string
  accountMenu?: React.ReactNode
  /** 「运营复审权限」开关开启时为 true；此时展示「微信群二维码」配置入口 */
  canManageGroupQr?: boolean
}) {
  const pathname = usePathname()
  const searchParams = useSearchParams()

  // 开关开启时，在「资料设置」前插入微信群二维码入口；关闭时完全隐藏
  const menuItems = canManageGroupQr
    ? [
        ...MENU_ITEMS.slice(0, MENU_ITEMS.length - 1),
        { path: '/operator/qrcode', label: '微信群二维码' },
        MENU_ITEMS[MENU_ITEMS.length - 1],
      ]
    : MENU_ITEMS

  const matchesCurrentPage = (path: string) => {
    const [itemPath, itemQuery] = path.split('?')
    if (pathname !== itemPath && !pathname.startsWith(`${itemPath}/`)) return false
    if (itemQuery) {
      for (const [key, value] of new URLSearchParams(itemQuery)) {
        if (searchParams.get(key) !== value) return false
      }
    }
    return true
  }
  // 优先匹配具体子页面，同一路径再优先匹配筛选入口，始终只高亮一项。
  const activeItem = menuItems.filter(item => matchesCurrentPage(item.path)).sort((a, b) => {
    const pathLength = b.path.split('?')[0].length - a.path.split('?')[0].length
    return pathLength || Number(b.path.includes('?')) - Number(a.path.includes('?'))
  })[0]

  async function handleLogout() {
    await fetch('/api/operator/logout', { method: 'POST' })
    window.location.assign('/auth/login')
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <DashboardHeader
        home="/operator/team"
        subtitle={operatorName}
        navigationLabel="运营后台导航"
        items={menuItems.map(item => ({ ...item, active: item.path === activeItem?.path }))}
        accountMenu={accountMenu || <button onClick={handleLogout} className="text-sm text-gray-500 hover:text-gray-700">退出</button>}
      />

      <main className="container mx-auto px-4 py-8">{children}</main>
    </div>
  )
}
