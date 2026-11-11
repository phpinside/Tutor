import Link from 'next/link'

type NavigationItem = {
  path: string
  label: string
  icon?: string
  active: boolean
}

export default function DashboardHeader({
  home,
  subtitle,
  navigationLabel,
  items,
  accountMenu,
}: {
  home: string
  subtitle: string
  navigationLabel: string
  items: NavigationItem[]
  accountMenu: React.ReactNode
}) {
  return (
    <header className="sticky top-0 z-30 border-b border-gray-200 bg-white shadow-sm">
      <div className="container mx-auto flex min-h-16 items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <Link href={home} className="flex min-w-0 items-center gap-2.5 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 sm:gap-3">
          <span aria-hidden className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-50 text-2xl">🎓</span>
          <span className="min-w-0">
            <span className="block truncate text-base font-bold text-gray-900 sm:text-lg">伴学管理后台</span>
            <span className="block truncate text-xs text-gray-500">{subtitle}</span>
          </span>
        </Link>
        <div className="shrink-0">{accountMenu}</div>
      </div>

      <nav aria-label={navigationLabel} className="border-t border-gray-100">
        <ul className="container mx-auto flex flex-wrap items-center gap-1 px-4 py-2 sm:px-6">
          {items.map(item => (
            <li key={item.path}>
              <Link
                href={item.path}
                aria-current={item.active ? 'page' : undefined}
                className={`inline-flex min-h-10 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg px-2.5 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 sm:px-3 ${
                  item.active
                    ? 'bg-primary-50 text-primary-700 ring-1 ring-inset ring-primary-100'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                }`}
              >
                {item.icon && <span aria-hidden>{item.icon}</span>}
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </header>
  )
}
