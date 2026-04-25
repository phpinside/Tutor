// 与 src/app/api/admin/login 使用同一套账号，供登录与敏感操作二次校验复用
export const ADMIN_ACCOUNTS = [
  { username: 'admin', password: 'admin123', role: 'super_admin' as const },
]

export function verifyAdminCredentials(username: string, password: string) {
  return ADMIN_ACCOUNTS.find(
    acc => acc.username === username && acc.password === password
  )
}
