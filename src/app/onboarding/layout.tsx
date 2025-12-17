export default function OnboardingLayout({
  children
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
      {/* 顶部装饰 */}
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary-500 to-indigo-500" />
      
      <main className="container mx-auto px-4 py-8 max-w-4xl">
        {children}
      </main>
      
      {/* 底部装饰 */}
      <div className="fixed bottom-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 to-primary-500 opacity-50" />
    </div>
  )
}

