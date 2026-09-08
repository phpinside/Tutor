import Link from 'next/link'

const TABS = [
  { key: 'drafts', href: '/admin/certificates', label: '申请列表' },
  { key: 'templates', href: '/admin/certificates/templates', label: '证明模板' },
  { key: 'companies', href: '/admin/certificates/companies', label: '开具单位' },
] as const

export type CertificateTabKey = (typeof TABS)[number]['key']

/** 「证明开具」模块内三个页面的切换标签栏 */
export default function CertificateSubNav({ active }: { active: CertificateTabKey }) {
  return (
    <div className="mb-6 flex w-fit gap-1 rounded-lg bg-white p-1 shadow">
      {TABS.map((tab) => (
        <Link
          key={tab.key}
          href={tab.href}
          className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
            active === tab.key ? 'bg-primary-600 text-white' : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          {tab.label}
        </Link>
      ))}
    </div>
  )
}
