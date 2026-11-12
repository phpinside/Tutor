import { getRequestOrigin } from '../request-url'

export function isSameOrigin(request: Request) {
  if (request.headers.get('sec-fetch-site') === 'cross-site') return false
  const origin = request.headers.get('origin')
  if (!origin) return true

  try {
    return origin === getRequestOrigin(request.headers, request.url)
  } catch {
    return false
  }
}
