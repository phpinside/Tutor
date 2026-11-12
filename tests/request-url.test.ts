import assert from 'node:assert/strict'
import { test } from 'node:test'
import { NextRequest } from 'next/server'
import { getRequestOrigin, getRequestUrl } from '../src/lib/request-url'
import { middleware } from '../src/middleware'

test('public URLs follow each request domain, protocol and port despite an internal listener', () => {
  for (const origin of ['https://tutor.example.com', 'https://preview.example.net:8443', 'http://localhost:3001']) {
    const publicUrl = new URL(origin)
    const headers = new Headers({
      host: 'localhost:3001',
      'x-forwarded-host': publicUrl.host,
      'x-forwarded-proto': publicUrl.protocol.slice(0, -1),
    })
    const request = new Request('https://localhost:3001/auth/continue', { headers })
    assert.equal(getRequestOrigin(headers, request.url), origin)
    assert.equal(getRequestOrigin(headers), origin, 'server components use the same public origin')
    assert.equal(getRequestUrl(request, '/operator/team?from=link').href, `${origin}/operator/team?from=link`)
  }
})

test('Host and request URL provide dynamic fallbacks without a configured app URL', () => {
  assert.equal(getRequestOrigin(new Headers({ host: 'public.example.net', 'x-forwarded-proto': 'https' }), 'http://localhost:3001'), 'https://public.example.net')
  assert.equal(getRequestOrigin(new Headers({ host: 'localhost:3108' })), 'http://localhost:3108')
  assert.equal(getRequestOrigin(new Headers(), 'http://127.0.0.1:3108/path'), 'http://127.0.0.1:3108')
  assert.throws(() => getRequestOrigin(new Headers()), /无法确定请求来源/)
})

test('middleware redirects to the public host and keeps login queries and business destinations', () => {
  const headers = { host: 'localhost:3001', 'x-forwarded-host': 'preview.example.net:8443', 'x-forwarded-proto': 'https' }
  const cases = [
    ['/operator/team?search=test', '/auth/login?redirect=%2Foperator%2Fteam%3Fsearch%3Dtest'],
    ['/admin/login?redirect=%2Fadmin%2Fteachers', '/auth/login?redirect=%2Fadmin%2Fteachers'],
    ['/operator/login?redirect=%2Foperator%2Fsettings', '/auth/login?redirect=%2Foperator%2Fsettings'],
  ]
  for (const [path, destination] of cases) {
    const response = middleware(new NextRequest(`https://localhost:3001${path}`, { headers }))
    assert.equal(response.headers.get('location'), `https://preview.example.net:8443${destination}`)
  }
})
