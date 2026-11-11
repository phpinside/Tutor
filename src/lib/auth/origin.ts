export function isSameOrigin(request: Request) {
  const origin = request.headers.get('origin')
  return request.headers.get('sec-fetch-site') !== 'cross-site' && (!origin || origin === new URL(request.url).origin)
}
