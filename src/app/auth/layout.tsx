export default function AuthLayout({
  children
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 flex items-center justify-center px-4 py-8">
      {/* 顶部装饰 */}
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary-500 to-indigo-500" />
      
      <div className="w-full max-w-md">
        {/* Logo 区域 */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            伴学教练平台
          </h1>
          <p className="text-gray-600">
            数理化伴学，从这里开始
          </p>
        </div>
        
        {/* 内容区域 */}
        <div className="bg-white rounded-2xl shadow-xl p-8">
          {children}
        </div>
      </div>
      
      {/* 底部装饰 */}
      <div className="fixed bottom-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 to-primary-500 opacity-50" />
    </div>
  )
}
