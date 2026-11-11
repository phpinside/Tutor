import Link from 'next/link'
export default function LoginHelpPage() {
  return <main className="px-4 py-8"><div className="card mx-auto max-w-md space-y-4"><h1 className="text-2xl font-bold">登录帮助</h1><p className="text-gray-600">忘记密码或无法完成账号关联时，请联系你的平台对接人员，由管理员核验账号归属后重置密码。</p><p className="text-sm text-gray-500">密码重置后，所有已关联工作台统一使用新密码，原设备需要重新登录。</p><Link href="/auth/login" className="inline-block text-blue-600">← 返回登录</Link></div></main>
}
