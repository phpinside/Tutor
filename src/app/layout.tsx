import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: '伴学老师新手引导系统',
  description: '欢迎加入数学1v1伴学团队,开启你的伴学之旅',
  keywords: ['伴学', '数学老师', '兼职', '教学'],
  authors: [{ name: '数学1v1伴学团队' }],
  viewport: 'width=device-width, initial-scale=1',
  themeColor: '#0284c7'
}

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="zh-CN">
      <body className="min-h-screen">
        {children}
      </body>
    </html>
  )
}

