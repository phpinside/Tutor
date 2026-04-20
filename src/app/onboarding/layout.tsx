import { cookies } from 'next/headers'
import { Suspense } from 'react'
import ReferralEntryButton from '@/components/ui/ReferralEntryButton'
import ToolsEntryButton from '@/components/ui/ToolsEntryButton'

export default async function OnboardingLayout({
  children
}: {
  children: React.ReactNode
}) {
  const cookieStore = await cookies()
  const teacherId = cookieStore.get('teacherId')?.value
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
      {/* 顶部装饰 */}
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary-500 to-indigo-500" />
      
      {/* 顶部导航 */}
      {teacherId && (
        <div className="sticky top-0 z-10 bg-white/80 backdrop-blur-sm border-b border-gray-200 shadow-sm">
          <div className="container mx-auto px-4 py-3 max-w-4xl flex justify-between items-center">
            <div className="text-lg font-semibold text-gray-900">伴学新手引导</div>
            <div className="flex items-center gap-2">
              <ToolsEntryButton />
              <Suspense fallback={<div className="w-24 h-10" />}>
                <ReferralEntryButton teacherId={teacherId} />
              </Suspense>
            </div>
          </div>
        </div>
      )}
      
      <main className="container mx-auto px-4 py-8 max-w-4xl">
        {children}
      </main>
      
      {/* 底部装饰 */}
      <div className="fixed bottom-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 to-primary-500 opacity-50" />
    </div>
  )
}

