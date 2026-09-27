import crypto from 'crypto'
import bcrypt from 'bcryptjs'

/**
 * 超管凭据改为从环境变量读取，不再硬编码在源码中：
 *   ADMIN_USERNAME        登录账号（默认 admin）
 *   ADMIN_PASSWORD_HASH   bcrypt 哈希（推荐；生成：npx bcryptjsCLI 或 node -e "console.log(require('bcryptjs').hashSync('新密码',10))"）
 *   ADMIN_PASSWORD        明文兜底（未配置 HASH 时使用）
 * 三者均未配置时，回退到旧默认口令并打印醒目警告（保证平滑迁移，请尽快在 .env 配置！）。
 */

const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin'

function timingSafeEqualStr(a: string, b: string): boolean {
  const ab = Buffer.from(a)
  const bb = Buffer.from(b)
  if (ab.length !== bb.length) {
    // 长度不同也要做等长比较，避免通过耗时差异探测长度：先哈希到等长再比较
    const ha = crypto.createHash('sha256').update(ab).digest()
    const hb = crypto.createHash('sha256').update(bb).digest()
    return crypto.timingSafeEqual(ha, hb)
  }
  return crypto.timingSafeEqual(ab, bb)
}

export type AdminAccount = { role: 'super_admin' }

/**
 * 校验超管账密。
 * 兼容旧调用方（原为同步、返回数组元素）：现改为 async，命中返回 { role: 'super_admin' }，否则 null。
 */
export async function verifyAdminCredentials(
  username: string,
  password: string
): Promise<AdminAccount | null> {
  const cleanUsername = (username || '').trim()
  if (cleanUsername !== ADMIN_USERNAME) return null

  // 优先：bcrypt 哈希（推荐）
  const hash = process.env.ADMIN_PASSWORD_HASH
  if (hash) {
    const ok = await bcrypt.compare(password, hash).catch(() => false)
    return ok ? { role: 'super_admin' } : null
  }

  // 次选：明文环境变量（等时比较）
  const plain = process.env.ADMIN_PASSWORD
  if (plain) {
    return timingSafeEqualStr(password, plain) ? { role: 'super_admin' } : null
  }

  // 兜底：未配置任何环境变量时保留旧默认口令，保证不锁死，但强提示
  console.warn(
    '[安全警告] 未配置 ADMIN_PASSWORD_HASH / ADMIN_PASSWORD，正在使用源码内置的默认口令。请尽快在 .env 中配置！'
  )
  return password === 'admin123' ? { role: 'super_admin' } : null
}
