import assert from 'node:assert/strict'
import { test } from 'node:test'
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const database = process.env.AUTH_TEST_DATABASE_URL
const base = process.env.AUTH_TEST_BASE_URL
// 必须显式指定专用本地测试库与服务，不能读取项目 .env 后误写业务库。
test('unified authentication against an isolated PostgreSQL and Next.js server', { skip: !database || !base }, async t => {
  const url = new URL(database!)
  assert.ok(['127.0.0.1', 'localhost'].includes(url.hostname) && url.pathname.startsWith('/tutor_auth_test'), 'only a dedicated local auth test database is allowed')
  assert.ok(['127.0.0.1', 'localhost'].includes(new URL(base!).hostname))
  const db = new PrismaClient({ datasourceUrl: database })
  const password = 'Auth-Test-123', secondPassword = 'Second-Test-456'
  const hash = await bcrypt.hash(password, 4), secondHash = await bcrypt.hash(secondPassword, 4)
  const prefix = `auth-${Date.now()}`
  const teacher = await db.teacher.create({ data: { name: prefix, phone: '13900009001', password: hash, subjects: [] } })
  const manager = await db.operator.create({ data: { name: prefix, phone: '13900009002', password: hash, role: 'LEARNER_MANAGER' } })
  const operator = await db.operator.create({ data: { name: prefix, phone: '13900009003', password: hash, role: 'OPERATOR' } })
  const dualTeacher = await db.teacher.create({ data: { name: prefix, phone: '13900009004', password: hash, subjects: [] } })
  const dualOperator = await db.operator.create({ data: { name: prefix, phone: '13900009004', password: secondHash, role: 'OPERATOR' } })
  const disabled = await db.operator.create({ data: { name: prefix, phone: '13900009005', password: hash, isEnabled: false } })
  const accounts: string[] = []
  const registeredTeachers: string[] = [], extraOperators: string[] = []
  const task = await db.taskConfig.create({ data: { index: 0, title: '认证测试表单', phase: 1, emoji: '📝', type: 'FORM', description: '测试', estimatedMinutes: 1, requirements: [] } })
  async function post(path: string, body: unknown, cookie = '', headers: Record<string, string> = {}) {
    const response = await fetch(`${base}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: new URL(base!).origin, 'Sec-Fetch-Site': 'same-origin', Cookie: cookie, ...headers }, body: JSON.stringify(body), redirect: 'manual' })
    const payload = await response.json()
    const token = response.headers.getSetCookie().find(value => value.startsWith('tutor_session='))?.split(';')[0] ?? ''
    if (path.endsWith('/login') && payload.success) {
      const session = await db.authSession.findUniqueOrThrow({ where: { tokenHash: createHash('sha256').update(token.split('=')[1]).digest('hex') } })
      if (!accounts.includes(session.accountId)) accounts.push(session.accountId)
    }
    return { response, payload, cookie: token }
  }
  async function get(path: string, cookie = '', headers: Record<string, string> = {}) { return fetch(`${base}${path}`, { headers: { Cookie: cookie, ...headers }, redirect: 'manual' }) }
  try {
    await db.authRateLimit.deleteMany()
    let teacherCookie = '', managerCookie = '', dualCookie = ''
    await t.test('one neutral login page, legacy URLs and anonymous deep links', async () => {
      const page = await get('/auth/login'), html = await page.text()
      assert.equal(page.status, 200); assert.ok(html.includes('欢迎使用伴学平台'))
      assert.ok(!html.includes('学管登录') && !html.includes('管理员登录'))
      const old = await get('/operator/login?redirect=%2Foperator%2Fsettings')
      assert.match(old.headers.get('location')!, /\/auth\/login\?redirect=/)
      const target = await get('/admin/teachers?search=test')
      assert.match(target.headers.get('location')!, /redirect=%2Fadmin%2Fteachers%3Fsearch%3Dtest/)
    })
    await t.test('anonymous redirects follow the public request origin rather than the internal host or app URL configuration', async () => {
      for (const origin of ['https://tutor.example.com', 'https://preview.example.net:8443']) {
        const url = new URL(origin)
        const headers = { 'X-Forwarded-Host': url.host, 'X-Forwarded-Proto': 'https' }
        const cases = [
          ['/operator/team?from=link', '/auth/login?redirect=%2Foperator%2Fteam%3Ffrom%3Dlink'],
          ['/admin/login?redirect=%2Fadmin%2Fteachers', '/auth/login?redirect=%2Fadmin%2Fteachers'],
          ['/auth/continue?redirect=%2Foperator%2Fteam', '/auth/login?redirect=%2Foperator%2Fteam'],
          ['/api/auth/force-logout', '/auth/login'],
          ['/api/init?ref=HOST%26CHECK', '/auth/register?ref=HOST%26CHECK'],
        ]
        for (const [path, destination] of cases) {
          const response = await get(path, '', headers)
          assert.equal(response.status, 307, path)
          assert.equal(response.headers.get('location'), `${origin}${destination}`, path)
        }
      }
    })
    await t.test('all ordinary roles migrate and enter their workspaces automatically', async () => {
      const result = await post('/api/auth/login', { identifier: teacher.phone, password })
      assert.equal(result.payload.redirectTo, '/onboarding'); teacherCookie = result.cookie
      assert.match(result.response.headers.getSetCookie().join(';'), /HttpOnly/i)
      const team = await post('/api/operator/login', { phone: manager.phone, password })
      assert.equal(team.payload.redirectTo, '/operator/team'); managerCookie = team.cookie
      assert.equal((await post('/api/auth/login', { identifier: operator.phone, password })).payload.redirectTo, '/operator/team')
    })
    await t.test('teacher pages render without serializing either profile or unified password hash', async () => {
      const profile = await db.teacher.findUniqueOrThrow({ where: { id: teacher.id }, include: { account: true } })
      const page = await get('/onboarding/task/0', teacherCookie), html = await page.text()
      assert.equal(page.status, 200)
      assert.ok(html.includes(prefix))
      assert.ok(!html.includes(profile.password) && !html.includes(profile.account!.passwordHash))
    })
    await t.test('forged old cookies, random session tokens and unauthorized workspace switching fail', async () => {
      const forged = `tutor_session=${'a'.repeat(64)};admin_session=${encodeURIComponent(JSON.stringify({ authenticated: true, role: 'super_admin' }))};teacherId=${teacher.id}`
      assert.match((await get('/admin/operators', forged)).headers.get('location')!, /\/auth\/login/)
      const forbidden = await post('/api/auth/workspace', { role: 'SUPER_ADMIN' }, teacherCookie)
      assert.equal(forbidden.response.status, 403)
      assert.equal((await post('/api/admin/redistribute-coach-reviews', {}, teacherCookie)).response.status, 401)
      const page = await get('/admin/operators', managerCookie)
      assert.match(page.headers.get('location')!, /\/operator\/team/)
    })
    await t.test('administrator bootstrap migrates once and configuration cannot bypass account disable', { skip: !process.env.AUTH_TEST_ADMIN_PASSWORD }, async () => {
      const identifier = process.env.AUTH_TEST_ADMIN_LOGIN || 'auth-test-admin'
      const result = await post('/api/admin/login', { username: identifier, password: process.env.AUTH_TEST_ADMIN_PASSWORD })
      assert.equal(result.payload.redirectTo, '/admin/teachers')
      const account = await db.account.findUniqueOrThrow({ where: { login: identifier } })
      assert.equal((await get('/admin/operators', result.cookie)).status, 200)
      await db.account.update({ where: { id: account.id }, data: { isEnabled: false } })
      assert.equal((await post('/api/auth/login', { identifier, password: process.env.AUTH_TEST_ADMIN_PASSWORD })).payload.success, false)
    })
    await t.test('registration creates only a teacher role and preserves invitations', async () => {
      const inviter = await db.teacher.update({ where: { id: teacher.id }, data: { inviteCode: 'AUTHTESTREF' } })
      const result = await post('/api/auth/register', { name: prefix, phone: '13900009006', password, confirmPassword: password, referralCode: inviter.inviteCode, role: 'SUPER_ADMIN' })
      assert.equal(result.payload.success, true)
      registeredTeachers.push(result.payload.teacherId)
      const created = await db.teacher.findUniqueOrThrow({ where: { id: result.payload.teacherId }, include: { account: { include: { roles: true } } } })
      accounts.push(created.accountId!)
      assert.equal(created.invitedById, teacher.id)
      assert.deepEqual(created.account!.roles.map(grant => grant.role), ['TEACHER'])
      assert.equal((await post('/api/auth/login', { identifier: created.phone, password })).payload.redirectTo, '/onboarding')
    })
    await t.test('same-phone accounts require both passwords before receiving both roles', async () => {
      const first = await post('/api/auth/login', { identifier: dualTeacher.phone, password })
      assert.equal(first.payload.requiresLink, true); assert.equal(first.cookie, '')
      assert.equal(await db.account.count({ where: { login: dualTeacher.phone } }), 0)
      assert.equal((await post('/api/auth/login', { identifier: dualTeacher.phone, password, linkedPassword: 'wrong-password' })).payload.success, false)
      const linked = await post('/api/auth/login', { identifier: dualTeacher.phone, password, linkedPassword: secondPassword })
      assert.equal(linked.payload.success, true); dualCookie = linked.cookie
      const account = await db.account.findUniqueOrThrow({ where: { login: dualTeacher.phone }, include: { roles: true, teacher: true, operator: true } })
      assert.equal(account.teacher?.accountId, account.operator?.accountId)
      assert.equal(account.roles.length, 2)
      assert.equal((await post('/api/auth/login', { identifier: dualTeacher.phone, password: secondPassword })).payload.success, false)
    })
    await t.test('authenticated continuation, force-logout return links and referral sharing use the current public origin', async () => {
      const headers = { 'X-Forwarded-Host': 'preview.example.net:8443', 'X-Forwarded-Proto': 'https' }
      for (const destination of ['/onboarding', '/operator/settings']) {
        const continueResponse = await get(`/auth/continue?redirect=${encodeURIComponent(destination)}`, dualCookie, headers)
        assert.equal(continueResponse.headers.get('location'), `https://preview.example.net:8443${destination}`)
        const rotatedCookie = continueResponse.headers.getSetCookie().find(value => value.startsWith('tutor_session='))?.split(';')[0]
        assert.ok(rotatedCookie)
        assert.notEqual(rotatedCookie, dualCookie)
        dualCookie = rotatedCookie
        assert.equal((await get(destination, dualCookie)).status, 200)
      }
      const returned = await get('/api/auth/force-logout?next=%2Freferral%2Fdashboard', teacherCookie, headers)
      assert.equal(returned.headers.get('location'), 'https://preview.example.net:8443/referral/dashboard')
      const unsafe = await get('/api/auth/force-logout?next=%2F%5Cevil.test', teacherCookie, headers)
      assert.equal(unsafe.headers.get('location'), 'https://preview.example.net:8443/onboarding')
      const init = await get('/api/init', teacherCookie, headers)
      assert.equal(init.headers.get('location'), 'https://preview.example.net:8443/auth/register')
      const dashboard = await get('/referral/dashboard', teacherCookie, headers)
      assert.equal(dashboard.status, 200)
      assert.ok((await dashboard.text()).includes('https://preview.example.net:8443/?ref=AUTHTESTREF'))
    })
    await t.test('cross-origin workspace requests preserve the existing session', async () => {
      const variants: Record<string, string>[] = [
        { Origin: 'https://evil.test', 'Sec-Fetch-Site': 'cross-site' },
        { Origin: 'https://other.bytemath.cn', 'Sec-Fetch-Site': 'same-site', 'X-Forwarded-Host': 'tutor.bytemath.cn', 'X-Forwarded-Proto': 'https' },
      ]
      for (const headers of variants) {
        const denied = await post('/api/auth/workspace', { role: 'TEACHER' }, dualCookie, headers)
        assert.equal(denied.response.status, 403)
        assert.match(denied.payload.error, /请求来源无效/)
        assert.equal(denied.cookie, '')
      }
      assert.equal((await get('/account', dualCookie)).status, 200)
    })
    await t.test('proxied coach and operator switches rotate tokens, remember context and preserve authorized deep links', async () => {
      const proxyHeaders = { Origin: 'https://tutor.bytemath.cn', 'X-Forwarded-Host': 'tutor.bytemath.cn', 'X-Forwarded-Proto': 'https' }
      const previous = dualCookie
      const switched = await post('/api/auth/workspace', { role: 'TEACHER' }, dualCookie, proxyHeaders)
      assert.equal(switched.response.status, 200)
      assert.equal(switched.payload.redirectTo, '/onboarding'); dualCookie = switched.cookie
      assert.ok(dualCookie)
      assert.notEqual(dualCookie, previous)
      assert.match((await get('/account', previous)).headers.get('location')!, /\/auth\/login/)
      assert.equal((await get('/onboarding', dualCookie)).status, 200)
      const coachCookie = dualCookie
      const operatorSwitch = await post('/api/auth/workspace', { role: 'OPERATOR' }, dualCookie, proxyHeaders)
      assert.equal(operatorSwitch.response.status, 200)
      assert.equal(operatorSwitch.payload.redirectTo, '/operator/team'); dualCookie = operatorSwitch.cookie
      assert.ok(dualCookie)
      assert.notEqual(dualCookie, coachCookie)
      assert.match((await get('/account', coachCookie)).headers.get('location')!, /\/auth\/login/)
      assert.equal((await get('/operator/team', dualCookie)).status, 200)
      const remembered = await post('/api/auth/login', { identifier: dualTeacher.phone, password })
      assert.equal(remembered.payload.redirectTo, '/operator/team')
      const backToCoach = await post('/api/auth/workspace', { role: 'TEACHER' }, dualCookie, proxyHeaders)
      assert.equal(backToCoach.response.status, 200); dualCookie = backToCoach.cookie
      const repeat = await post('/api/auth/login', { identifier: dualTeacher.phone, password })
      assert.equal(repeat.payload.redirectTo, '/onboarding')
      const deep = await post('/api/auth/login', { identifier: dualTeacher.phone, password, redirect: '/operator/settings?from=link' })
      assert.equal(deep.payload.redirectTo, '/operator/settings?from=link')
      assert.equal((await post('/api/auth/login', { identifier: teacher.phone, password, redirect: '//evil.test' })).payload.redirectTo, '/onboarding')
    })
    await t.test('disabled role and account changes take effect on the next request', async () => {
      assert.equal((await post('/api/auth/login', { identifier: disabled.phone, password })).payload.success, false)
      await db.operator.update({ where: { id: manager.id }, data: { isEnabled: false } })
      assert.match((await get('/account', managerCookie)).headers.get('location')!, /\/auth\/login/)
      await db.operator.update({ where: { id: manager.id }, data: { isEnabled: true } })
      const owner = await db.teacher.findUniqueOrThrow({ where: { id: teacher.id } })
      await db.account.update({ where: { id: owner.accountId! }, data: { isEnabled: false } })
      assert.equal((await post('/api/auth/login', { identifier: teacher.phone, password })).payload.success, false)
      await db.account.update({ where: { id: owner.accountId! }, data: { isEnabled: true } })
    })
    await t.test('restricting a teacher role preserves its verified management role', async () => {
      await db.teacher.update({ where: { id: dualTeacher.id }, data: { permanentlyRejectedAt: new Date() } })
      assert.match((await get('/account', dualCookie)).headers.get('location')!, /\/auth\/login/)
      const result = await post('/api/auth/login', { identifier: dualTeacher.phone, password })
      assert.equal(result.payload.redirectTo, '/operator/team'); dualCookie = result.cookie
      await db.teacher.update({ where: { id: dualTeacher.id }, data: { permanentlyRejectedAt: null } })
    })
    await t.test('password verification updates linked credentials and revokes every device session', async () => {
      assert.equal((await post('/api/auth/password', { oldPassword: 'wrong-password', newPassword: 'New-Password-123' }, dualCookie)).payload.success, false)
      assert.equal((await post('/api/auth/password', { oldPassword: password, newPassword: 'New-Password-123' }, dualCookie)).payload.success, true)
      const account = await db.account.findUniqueOrThrow({ where: { login: dualTeacher.phone } })
      assert.equal(await db.authSession.count({ where: { accountId: account.id } }), 0)
      const updated = await db.operator.findUniqueOrThrow({ where: { id: dualOperator.id } })
      assert.ok(await bcrypt.compare('New-Password-123', updated.password))
      assert.equal((await post('/api/auth/login', { identifier: dualTeacher.phone, password })).payload.success, false)
      assert.equal((await post('/api/auth/login', { identifier: dualTeacher.phone, password: 'New-Password-123' })).payload.success, true)
    })
    await t.test('logout clears the shared session through legacy endpoints', async () => {
      assert.equal((await post('/api/operator/logout', {}, teacherCookie)).payload.success, true)
      assert.match((await get('/account', teacherCookie)).headers.get('location')!, /\/auth\/login/)
    })
    await t.test('batch migration is read-only by default, skips ambiguous accounts and is repeatable', async () => {
      const single = await db.teacher.create({ data: { name: prefix, phone: '13900009007', password: hash, subjects: [] } })
      const conflict = await db.teacher.create({ data: { name: prefix, phone: '13900009008', password: hash, subjects: [] } })
      const other = await db.operator.create({ data: { name: prefix, phone: conflict.phone, password: secondHash } })
      registeredTeachers.push(single.id, conflict.id); extraOperators.push(other.id)
      const run = (apply = false) => {
        const result = spawnSync('node_modules/.bin/tsx', ['prisma/migrateUnifiedAccounts.ts', ...(apply ? ['--apply'] : [])], { env: { ...process.env, DATABASE_URL: database! }, encoding: 'utf8', timeout: 30000 })
        assert.equal(result.status, 0, result.stderr)
        assert.ok(!result.stdout.includes(hash) && !result.stdout.includes(secondHash))
        return JSON.parse(result.stdout.trim().split('\n').at(-1)!)
      }
      assert.equal(run().mode, 'dry-run')
      assert.equal(await db.account.count({ where: { login: single.phone } }), 0)
      assert.ok(run(true).migrated > 0)
      const migrated = await db.account.findUniqueOrThrow({ where: { login: single.phone } })
      assert.equal(migrated.passwordHash, hash)
      assert.equal(await db.account.count({ where: { login: conflict.phone } }), 0)
      assert.equal(run(true).migrated, 0)
      const created = await db.account.findMany({ where: { name: prefix }, select: { id: true } })
      for (const account of created) if (!accounts.includes(account.id)) accounts.push(account.id)
    })
    await t.test('legacy login endpoints share the same database rate limit', async () => {
      for (let i = 0; i < 10; i++) await post(i % 2 ? '/api/admin/login' : '/api/auth/login', { identifier: 'auth-missing-test', password: 'wrong-password' })
      const blocked = await post('/api/operator/login', { identifier: 'auth-missing-test', password: 'wrong-password' })
      assert.match(blocked.payload.error, /尝试次数过多/)
    })
  } finally {
    await db.teacher.deleteMany({ where: { id: { in: [teacher.id, dualTeacher.id, ...registeredTeachers] } } })
    await db.operator.deleteMany({ where: { id: { in: [manager.id, operator.id, dualOperator.id, disabled.id, ...extraOperators] } } })
    await db.account.deleteMany({ where: { id: { in: accounts } } })
    await db.auditLog.deleteMany({ where: { targetId: { in: accounts } } })
    await db.taskConfig.delete({ where: { id: task.id } })
    await db.$disconnect()
  }
})
