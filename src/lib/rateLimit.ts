/**
 * 简易内存级限流：单实例部署有效。
 * 多实例 / Serverless 环境请替换为 Redis / Upstash 等共享存储实现（接口签名保持不变）。
 */
type Bucket = { count: number; resetAt: number }
const buckets = new Map<string, Bucket>()

export function checkRateLimit(
  key: string,
  maxAttempts: number,
  windowMs: number
): { allowed: boolean; retryAfterSec: number } {
  const now = Date.now()

  // 惰性清理过期桶，防止 Map 无限增长
  if (buckets.size > 5000) {
    for (const [k, v] of buckets) {
      if (v.resetAt <= now) buckets.delete(k)
    }
  }

  const bucket = buckets.get(key)
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs })
    return { allowed: true, retryAfterSec: 0 }
  }

  bucket.count += 1
  if (bucket.count > maxAttempts) {
    return { allowed: false, retryAfterSec: Math.ceil((bucket.resetAt - now) / 1000) }
  }
  return { allowed: true, retryAfterSec: 0 }
}

/** 从 x-forwarded-for 提取客户端 IP（取第一跳） */
export function getClientIpFromForwarded(forwarded: string | null | undefined): string {
  return forwarded?.split(',')[0]?.trim() || 'unknown'
}
