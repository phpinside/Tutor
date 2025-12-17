import { redirect } from 'next/navigation'

export default function HomePage() {
  // 重定向到引导页面
  redirect('/onboarding')
}

