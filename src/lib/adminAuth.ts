import { sanitizeInput } from '@/lib/utils'

// 与 src/app/api/admin/login 使用同一套账号，供登录与敏感操作二次校验复用
export const ADMIN_ACCOUNTS = [
  { username: 'admin', password: 'admin123', role: 'super_admin' as const },
]

export function verifyAdminCredentials(username: string, password: string) {
  // 去除账号两端的空格和空字符（密码不处理，可能包含有意空格）
  const cleanUsername = sanitizeInput(username)
  return ADMIN_ACCOUNTS.find(
    acc => acc.username === cleanUsername && acc.password === password
  )
}
