export const SESSION_COOKIE = 'tutor_session'
export const ROLES = ['TEACHER', 'LEARNER_MANAGER', 'OPERATOR', 'SUPER_ADMIN'] as const
export type Role = (typeof ROLES)[number]
export const ROLE_LABELS: Record<Role, string> = {
  TEACHER: '教练工作台', LEARNER_MANAGER: '学管工作台', OPERATOR: '运营工作台', SUPER_ADMIN: '管理工作台',
}
export const ROLE_HOME: Record<Role, string> = {
  TEACHER: '/onboarding', LEARNER_MANAGER: '/operator/team', OPERATOR: '/operator/team', SUPER_ADMIN: '/admin/teachers',
}
export function isRole(value: unknown): value is Role {
  return ROLES.includes(value as Role)
}
function under(path: string, base: string) {
  return path === base || path.startsWith(`${base}/`)
}
/** 仅接受规范的站内业务页面；排除协议相对 URL、转义、控制字符和认证回环。 */
export function safeDestination(value?: string | null): string | null {
  if (!value || !value.startsWith('/') || /[\\\s\u0000-\u001f\u007f]/.test(value) || value.startsWith('//')) return null
  try {
    const url = new URL(value, 'https://local.invalid')
    const decoded = decodeURIComponent(url.pathname)
    if (url.origin !== 'https://local.invalid' || decoded !== url.pathname || url.pathname !== value.split(/[?#]/)[0]) return null
    if (under(url.pathname, '/auth') || under(url.pathname, '/api') || url.pathname.endsWith('/login')) return null
    return url.pathname + url.search
  } catch { return null }
}
export function canAccessPath(role: Role, destination: string): boolean {
  const safe = safeDestination(destination)
  if (!safe) return false
  const path = safe.split('?')[0]
  if (under(path, '/account')) return true
  if (role === 'TEACHER') return under(path, '/onboarding') || under(path, '/referral/dashboard') || under(path, '/referral/withdraw')
  if (role === 'SUPER_ADMIN') return under(path, '/admin')
  return under(path, '/operator') || under(path, '/admin/teachers') || under(path, '/admin/tencent-meetings')
}
export function chooseWorkspace(roles: Role[], lastRole?: Role | null, defaultRole?: Role | null, destination?: string | null) {
  const fallback = [lastRole, defaultRole, ...ROLES].find((role): role is Role => Boolean(role && roles.includes(role)))
  if (!fallback) return null
  const safe = safeDestination(destination)
  const role = safe ? [fallback, ...roles].find(role => canAccessPath(role, safe)) ?? fallback : fallback
  return { role, destination: safe && canAccessPath(role, safe) ? safe : ROLE_HOME[role] }
}
