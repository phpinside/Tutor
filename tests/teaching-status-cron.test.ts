import assert from 'node:assert/strict'
import { afterEach, beforeEach, mock, test } from 'node:test'
import Module from 'node:module'
import { NextRequest } from 'next/server'

type Referral = {
  id: string
  referrerId: string
  referredId: string
  type: 'DIRECT' | 'INDIRECT'
  status: 'VALID' | 'PENDING' | 'INVALID'
  teachingCompletedAt: Date | null
  lessonNote?: string
  verifiedBy?: string
  verifiedAt?: Date
  referred: { id: string; name: string; phone: string; teachingStatus: string }
}

let referrals: Referral[] = []
let superAdmin = false
let authChecks = 0
let reads = 0
let writes = 0
let queryError = false
const statsUpdates: string[] = []
const revalidated: string[] = []

// 内存替身只隔离数据库、会话和缓存；运行真实路由及共享授课逻辑。
const prisma = {
  referral: {
    async findMany({ where, take }: any) {
      reads++
      if (queryError) throw new Error('test database unavailable')
      if (where.status) {
        return referrals.filter(row => row.status === where.status
          && row.teachingCompletedAt === null
          && (!where.id || row.id > where.id.gt))
          .sort((a, b) => a.id.localeCompare(b.id)).slice(0, take)
      }
      return referrals.filter(row => row.referredId === where.referredId && row.type === where.type)
    },
    async findUnique({ where }: any) {
      reads++
      return referrals.find(row => row.id === where.id) ?? null
    },
    async update({ where, data }: any) {
      writes++
      const row = referrals.find(row => row.id === where.id)!
      Object.assign(row, data)
      return row
    },
  },
  teacher: {
    async update({ where, data }: any) {
      writes++
      for (const row of referrals.filter(row => row.referredId === where.id)) {
        Object.assign(row.referred, data)
      }
    },
  },
}

// tsx 将这些模块加载为 CommonJS，临时替换依赖后即恢复加载器。
const loader = Module as unknown as { _load: (id: string, parent: unknown, isMain?: boolean) => any }
const originalLoad = loader._load
const previousCronSecret = process.env.CRON_SECRET
const previousApiToken = process.env.EXTERNAL_TUTOR_API_TOKEN
process.env.CRON_SECRET = 'teaching-status-test-secret'
process.env.EXTERNAL_TUTOR_API_TOKEN = 'teaching-status-test-api-token'
let route: typeof import('../src/app/api/cron/check-teaching-status/route')
let actions: typeof import('../src/app/actions/referral')
try {
  loader._load = function (id, parent, isMain) {
    if (id === 'server-only') return {}
    if (id === '@/lib/prisma') return { prisma }
    if (id === 'next/cache') return { revalidatePath: (path: string) => revalidated.push(path) }
    if (id === '@/app/actions/teacher' || id === './teacher') {
      return { updateReferralStats: async (id: string) => { statsUpdates.push(id); return { success: true } } }
    }
    if (id === '@/lib/admin-auth') {
      return { isSuperAdmin: async () => { authChecks++; return superAdmin } }
    }
    if (id === '@/lib/auth/compat') {
      return { cookies: async () => { throw new Error('Cron must not read login cookies') } }
    }
    return originalLoad.call(this, id, parent, isMain)
  }
  route = require('../src/app/api/cron/check-teaching-status/route')
  actions = require('../src/app/actions/referral')
} finally {
  loader._load = originalLoad
  if (previousCronSecret === undefined) delete process.env.CRON_SECRET
  else process.env.CRON_SECRET = previousCronSecret
  if (previousApiToken === undefined) delete process.env.EXTERNAL_TUTOR_API_TOKEN
  else process.env.EXTERNAL_TUTOR_API_TOKEN = previousApiToken
}

function referral(index: number, overrides: Partial<Referral> = {}): Referral {
  return {
    id: String(index).padStart(5, '0'),
    referrerId: `inviter-${index}`,
    referredId: `teacher-${index}`,
    type: 'DIRECT', status: 'VALID', teachingCompletedAt: null,
    referred: { id: `teacher-${index}`, name: `老师${index}`, phone: `139${String(index).padStart(8, '0')}`, teachingStatus: 'NOT_TAUGHT' },
    ...overrides,
  }
}

function request(headers: Record<string, string> = {}, method = 'GET') {
  return new NextRequest('http://localhost/api/cron/check-teaching-status', { headers, method })
}
const cronHeaders = { authorization: 'Bearer teaching-status-test-secret' }

beforeEach(() => {
  referrals = []
  superAdmin = false
  authChecks = reads = writes = 0
  queryError = false
  statsUpdates.length = revalidated.length = 0
  mock.method(console, 'log', () => {})
  mock.method(console, 'error', () => {})
})
afterEach(() => mock.restoreAll())

test('missing or wrong Cron Secret is rejected before any database access, even for an admin', async () => {
  superAdmin = true
  const headersList: Record<string, string>[] = [{}, { authorization: 'Bearer wrong' }]
  for (const headers of headersList) {
    const response = await route.GET(request(headers))
    assert.equal(response.status, 401)
    assert.equal((await response.json()).success, false)
  }
  assert.equal(reads, 0)
  assert.equal(writes, 0)
  assert.equal(authChecks, 0)
})

test('Secret alone checks and marks every page, caches shared teachers, and supports repeated runs', async t => {
  referrals = Array.from({ length: 55 }, (_, index) => referral(index + 1))
  const first = referrals[0]
  referrals.push(referral(56, { type: 'INDIRECT', referredId: first.referredId, referred: first.referred }))
  const ignored = [
    referral(57, { status: 'PENDING' }),
    referral(58, { status: 'INVALID' }),
    referral(59, { teachingCompletedAt: new Date() }),
  ]
  referrals.push(...ignored)
  const fetchCalls: string[] = []
  t.mock.method(globalThis, 'fetch', async (input: string | URL | Request) => {
    fetchCalls.push(String(input))
    return Response.json({ success: true, data: { regularLessonHours: 20 } })
  })

  const response = await route.GET(request(cronHeaders))
  const payload = await response.json()
  assert.equal(response.status, 200)
  assert.equal(payload.success, true)
  assert.equal(payload.data.processed, 56)
  assert.equal(payload.data.marked, 56)
  assert.deepEqual(payload.data.failed, [])
  assert.equal(fetchCalls.length, 55)
  assert.equal(authChecks, 0)
  assert.ok(referrals.slice(0, 56).every(row => row.teachingCompletedAt && row.referred.teachingStatus === 'TAUGHT'))
  assert.ok(statsUpdates.includes(first.referrerId) && statsUpdates.includes('inviter-56'))
  assert.ok(revalidated.includes('/admin/referrals') && revalidated.includes('/referral/dashboard'))
  assert.equal(ignored[0].teachingCompletedAt, null)
  assert.equal(ignored[1].teachingCompletedAt, null)
  assert.equal(ignored[2].verifiedBy, undefined)

  const previousWrites = writes
  const second = await route.GET(request(cronHeaders))
  assert.equal(second.status, 200)
  assert.equal((await second.json()).data.processed, 0)
  assert.equal(writes, previousWrites)
  assert.equal(fetchCalls.length, 55)
})

test('insufficient hours across pages stay pending without causing an endless retry', async t => {
  referrals = Array.from({ length: 52 }, (_, index) => referral(index + 1))
  t.mock.method(globalThis, 'fetch', async () => Response.json({ success: true, data: { regularLessonHours: 19 } }))
  const response = await route.GET(request(cronHeaders))
  const payload = await response.json()
  assert.equal(response.status, 200)
  assert.equal(payload.data.processed, 52)
  assert.equal(payload.data.marked, 0)
  assert.equal(payload.data.insufficient.length, 52)
  assert.equal(writes, 0)
})

test('database failures preserve the reason and return an unsuccessful HTTP response', async () => {
  queryError = true
  const response = await route.GET(request(cronHeaders))
  const payload = await response.json()
  assert.equal(response.status, 500)
  assert.equal(payload.success, false)
  assert.equal(payload.data.processed, 0)
  assert.match(payload.data.failed[0], /获取第1页邀请记录失败: test database unavailable/)
})

test('external API failures return failure without marking teaching completed', async t => {
  referrals = [referral(1)]
  t.mock.method(globalThis, 'fetch', async () => new Response('unavailable', { status: 503, statusText: 'Service Unavailable' }))
  const response = await route.GET(request(cronHeaders))
  const payload = await response.json()
  assert.equal(response.status, 500)
  assert.equal(payload.success, false)
  assert.match(payload.data.failed[0], /HTTP 503/)
  assert.equal(writes, 0)
})

test('POST and the existing Cron header also work without an admin session', async () => {
  const response = await route.POST(request({ 'x-vercel-cron-secret': 'teaching-status-test-secret' }, 'POST'))
  assert.equal(response.status, 200)
  assert.equal((await response.json()).success, true)
  assert.equal(authChecks, 0)
})

test('admin Server Actions still reject non-admin callers before database access', async () => {
  const listed = await actions.getAllReferrals()
  const marked = await actions.markTeachingCompleted('00001', '完成20课时')
  assert.equal(listed.success, false)
  assert.equal(marked.success, false)
  assert.match(marked.error!, /仅超级管理员/)
  assert.equal(reads, 0)
  assert.equal(writes, 0)
})

test('authorized admin marking retains validation, audit fields and duplicate protection', async () => {
  superAdmin = true
  referrals = [referral(1)]
  assert.equal((await actions.markTeachingCompleted('00001', ' ')).success, false)
  assert.equal(writes, 0)
  assert.equal((await actions.markTeachingCompleted('missing', '完成20课时')).success, false)
  assert.equal((await actions.markTeachingCompleted('00001', '完成20课时', '管理员')).success, true)
  assert.equal(referrals[0].lessonNote, '完成20课时')
  assert.equal(referrals[0].verifiedBy, '管理员')
  assert.equal(referrals[0].verifiedAt, referrals[0].teachingCompletedAt)
  const previousWrites = writes
  assert.equal((await actions.markTeachingCompleted('00001', '再次标记')).success, false)
  assert.equal(writes, previousWrites)
})
