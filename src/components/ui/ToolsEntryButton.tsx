import Link from 'next/link'

export default function ToolsEntryButton() {
  return (
    <Link
      href="/onboarding/tools"
      className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-violet-500 to-indigo-500 hover:from-violet-600 hover:to-indigo-600 text-white rounded-lg transition-all font-medium shadow-md"
    >
      <span className="text-lg">🛠️</span>
      <span className="text-sm">常用工具</span>
    </Link>
  )
}
