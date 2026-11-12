type RequestHeaders = Pick<Headers, 'get'>

/** 浏览器实际访问的来源，兼容反向代理和本地开发；不依赖固定域名配置。 */
export function getRequestOrigin(headers: RequestHeaders, requestUrl?: string): string {
  const url = requestUrl ? new URL(requestUrl) : undefined
  // 入口代理须覆盖这两个转发头；多级代理取最外层的公网地址。
  const host = headers.get('x-forwarded-host')?.split(',')[0].trim()
    ?? headers.get('host') ?? url?.host
  const protocol = headers.get('x-forwarded-proto')?.split(',')[0].trim()
    ?? url?.protocol.slice(0, -1) ?? 'http'
  if (!host || /[\s/\\?#@]/.test(host) || !['http', 'https'].includes(protocol)) {
    throw new Error('无法确定请求来源')
  }
  return new URL(`${protocol}://${host}`).origin
}

export function getRequestUrl(request: Pick<Request, 'headers' | 'url'>, path: string): URL {
  return new URL(path, getRequestOrigin(request.headers, request.url))
}
