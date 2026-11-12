export function isSameOrigin(request: Request) {
  if (request.headers.get('sec-fetch-site') === 'cross-site') return false
  const origin = request.headers.get('origin')
  if (!origin) return true

  try {
    // Next.js 的 request.url 可能使用内部监听地址。代理转发的域名和协议
    // 才是浏览器访问的来源；部署时代理必须覆盖这些转发头。
    const url = new URL(request.url)
    const host = request.headers.get('x-forwarded-host')?.split(',')[0].trim()
      ?? request.headers.get('host') ?? url.host
    const protocol = request.headers.get('x-forwarded-proto')?.split(',')[0].trim()
      ?? url.protocol.slice(0, -1)
    if (!host || /[\s/\\?#@]/.test(host) || !['http', 'https'].includes(protocol)) return false
    return origin === new URL(`${protocol}://${host}`).origin
  } catch {
    return false
  }
}
