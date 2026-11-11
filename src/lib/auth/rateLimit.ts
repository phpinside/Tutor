import { createHash } from 'node:crypto'
import { prisma } from '@/lib/prisma'

/** PostgreSQL 原子计数，覆盖所有实例及旧登录接口。 */
export async function checkAuthRateLimit(key: string, maxAttempts: number, windowMs: number) {
  const digest = createHash('sha256').update(key).digest('hex')
  const now = new Date(), nextReset = new Date(Date.now() + windowMs)
  const [row] = await prisma.$queryRaw<Array<{ count: number; resetsAt: Date }>>`
    INSERT INTO "auth_rate_limits" ("key", "count", "resetsAt") VALUES (${digest}, 1, ${nextReset})
    ON CONFLICT ("key") DO UPDATE SET
      "count" = CASE WHEN "auth_rate_limits"."resetsAt" <= ${now} THEN 1 ELSE "auth_rate_limits"."count" + 1 END,
      "resetsAt" = CASE WHEN "auth_rate_limits"."resetsAt" <= ${now} THEN ${nextReset} ELSE "auth_rate_limits"."resetsAt" END
    RETURNING "count", "resetsAt"
  `
  return { allowed: row.count <= maxAttempts, retryAfterSec: Math.max(1, Math.ceil((row.resetsAt.getTime() - now.getTime()) / 1000)) }
}
