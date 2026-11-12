import assert from 'node:assert/strict'
import { test } from 'node:test'
import { isSameOrigin } from '../src/lib/auth/origin'

function request(url: string, headers: Record<string, string> = {}) {
  return new Request(url, { method: 'POST', headers })
}

test('direct same-origin requests retain protocol and port checks', () => {
  assert.equal(isSameOrigin(request('http://localhost:3000/api/auth/workspace', { origin: 'http://localhost:3000' })), true)
  assert.equal(isSameOrigin(request('http://localhost:3000/api/auth/workspace', { origin: 'http://localhost:3001' })), false)
  assert.equal(isSameOrigin(request('http://localhost:3000/api/auth/workspace', { origin: 'https://localhost:3000' })), false)
})

test('reverse-proxied HTTPS requests use the public host and protocol rather than the Next.js listener', () => {
  const headers = { origin: 'https://tutor.bytemath.cn', 'sec-fetch-site': 'same-origin', 'x-forwarded-proto': 'https' }
  const hosts: Record<string, string>[] = [
    { host: 'tutor.bytemath.cn' },
    { host: 'localhost:3000', 'x-forwarded-host': 'tutor.bytemath.cn' },
    { host: 'localhost:3000', 'x-forwarded-host': 'tutor.bytemath.cn, internal-proxy:3000' },
  ]
  for (const hostHeaders of hosts) {
    assert.equal(isSameOrigin(request('http://localhost:3000/api/auth/workspace', { ...headers, ...hostHeaders })), true)
  }
  assert.equal(isSameOrigin(request('http://0.0.0.0:3000/api/auth/workspace', {
    ...headers, origin: 'https://tutor.bytemath.cn:8443', 'x-forwarded-host': 'tutor.bytemath.cn:8443',
  })), true)
})

test('proxy headers do not allow other origins, sibling domains or the internal listener', () => {
  const headers = { host: 'localhost:3000', 'x-forwarded-host': 'tutor.bytemath.cn', 'x-forwarded-proto': 'https' }
  for (const origin of ['https://evil.test', 'https://other.bytemath.cn', 'http://tutor.bytemath.cn', 'https://tutor.bytemath.cn:8443', 'http://localhost:3000', 'null']) {
    assert.equal(isSameOrigin(request('http://localhost:3000/api/auth/workspace', { ...headers, origin })), false, origin)
  }
})

test('cross-site fetch metadata is rejected even with matching origin or no origin', () => {
  const variants: Record<string, string>[] = [{ origin: 'https://tutor.bytemath.cn' }, {}]
  for (const headers of variants) {
    assert.equal(isSameOrigin(request('https://tutor.bytemath.cn/api/auth/workspace', { ...headers, 'sec-fetch-site': 'cross-site' })), false)
  }
})

test('malformed forwarded hosts and protocols fail closed', () => {
  const headers = { origin: 'https://tutor.bytemath.cn', 'x-forwarded-proto': 'https' }
  for (const host of ['', 'user@tutor.bytemath.cn', 'tutor.bytemath.cn/path', 'tutor.bytemath.cn?query', 'tutor.bytemath.cn#hash', 'tutor.bytemath.cn\\path', 'tutor.bytemath.cn other.test', '[invalid']) {
    assert.equal(isSameOrigin(request('http://localhost:3000/api/auth/workspace', { ...headers, 'x-forwarded-host': host })), false, host)
  }
  for (const protocol of ['', 'ftp', 'https:']) {
    assert.equal(isSameOrigin(request('http://localhost:3000/api/auth/workspace', { ...headers, 'x-forwarded-host': 'tutor.bytemath.cn', 'x-forwarded-proto': protocol })), false, protocol)
  }
})

test('clients without Origin remain supported', () => {
  assert.equal(isSameOrigin(request('http://localhost:3000/api/auth/workspace')), true)
})
