import LogoutButton from './LogoutButton'

export default function AdminLayout({
  children
}: {
  children: React.ReactNode
}) {
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
              <a 
                href="/admin/review"
                className="text-sm font-medium text-gray-600 hover:text-gray-900"
              >
                任务审核
              </a>
              <a 
                href="/admin/teachers"
                className="text-sm font-medium text-gray-600 hover:text-gray-900"
              >
                老师管理
              </a>
              <a 
                href="/admin/config"
                className="text-sm font-medium text-gray-600 hover:text-gray-900"
              >
                系统配置
              </a>
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

