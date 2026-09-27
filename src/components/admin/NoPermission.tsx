import Link from 'next/link'

export default function NoPermission({
  title = '无权限访问',
  description = '你当前的角色没有权限查看该内容。如需访问，请联系超级管理员开通相应权限。',
  backHref = '/admin/teachers',
  backLabel = '返回老师管理',
}: {
  title?: string
  description?: string
  backHref?: string
  backLabel?: string
}) {
  return (
    <div className="card text-center py-16 max-w-xl mx-auto">
      <div className="text-5xl mb-4">🔒</div>
      <h2 className="text-xl font-semibold text-gray-900 mb-3">{title}</h2>
      <p className="text-sm text-gray-500 leading-relaxed mb-8 whitespace-pre-line">{description}</p>
      <Link href={backHref} className="btn-primary inline-block">
        {backLabel}
      </Link>
    </div>
  )
}
