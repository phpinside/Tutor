import type { Metadata } from 'next'
export const metadata: Metadata = { title: '伴学平台 · 账号' }
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
    <div className="absolute left-0 top-0 h-1 w-full bg-gradient-to-r from-primary-500 to-indigo-500" />
    <header className="px-4 pt-8 text-center"><p className="text-lg font-semibold text-gray-700">伴学平台</p></header>
    {children}
  </div>
}
