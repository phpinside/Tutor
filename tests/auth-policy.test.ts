import assert from 'node:assert/strict'
import { test } from 'node:test'
import { safeDestination, canAccessPath, chooseWorkspace } from '../src/lib/auth/policy'
import { availableRoles, type AccountWithProfiles } from '../src/lib/auth/accounts'

test('redirects accept business links and reject external URLs, traversal, encoded paths and auth loops', () => {
  assert.equal(safeDestination('/admin/teachers?search=张三'), '/admin/teachers?search=%E5%BC%A0%E4%B8%89')
  for (const path of ['https://evil.test', '//evil.test', '/\\evil.test', '/%2f%2fevil.test', '/%252fevil.test', '/onboarding/../admin', '/onboarding/./task', '/auth/login', '/auth/continue', '/api/auth/logout', '/operator/login', '/onboarding\n']) assert.equal(safeDestination(path), null, path)
})
test('roles authorize complete path segments; a shared admin URL does not grant admin rights', () => {
  assert.equal(canAccessPath('TEACHER', '/admin/teachers'), false)
  assert.equal(canAccessPath('LEARNER_MANAGER', '/admin/teachers/123'), true)
  assert.equal(canAccessPath('OPERATOR', '/admin/tencent-meetings'), true)
  for (const role of ['LEARNER_MANAGER', 'OPERATOR'] as const) {
    assert.equal(canAccessPath(role, '/admin/teachers-evil'), false)
    assert.equal(canAccessPath(role, '/admin/operators'), false)
    assert.equal(canAccessPath(role, '/admin/config'), false)
  }
  assert.equal(canAccessPath('SUPER_ADMIN', '/admin/config'), true)
  assert.equal(canAccessPath('TEACHER', '/referral/dashboard'), true)
  assert.equal(canAccessPath('SUPER_ADMIN', '/onboarding'), false)
})
test('authorized deep links precede last workspace, default role and least privilege fallback', () => {
  assert.deepEqual(chooseWorkspace(['TEACHER', 'SUPER_ADMIN'], 'TEACHER', 'SUPER_ADMIN'), { role: 'TEACHER', destination: '/onboarding' })
  assert.equal(chooseWorkspace(['TEACHER', 'SUPER_ADMIN'], null, 'TEACHER', '/admin/config')?.role, 'SUPER_ADMIN')
  assert.equal(chooseWorkspace(['TEACHER', 'SUPER_ADMIN'], null, 'TEACHER', '//evil.test')?.destination, '/onboarding')
  assert.equal(chooseWorkspace(['TEACHER'], 'SUPER_ADMIN', 'SUPER_ADMIN', '/admin/config')?.destination, '/onboarding')
  assert.equal(chooseWorkspace(['TEACHER', 'SUPER_ADMIN'])?.role, 'TEACHER')
  assert.equal(chooseWorkspace([]), null)
})
test('disabled accounts, grants and business roles are checked together', () => {
  const account = { isEnabled: true, roles: [{ role: 'TEACHER', isEnabled: true }, { role: 'LEARNER_MANAGER', isEnabled: true }, { role: 'SUPER_ADMIN', isEnabled: false }], teacher: { permanentlyRejectedAt: null }, operator: { role: 'LEARNER_MANAGER', isEnabled: true } } as AccountWithProfiles
  assert.deepEqual(availableRoles(account), ['TEACHER', 'LEARNER_MANAGER'])
  account.operator!.isEnabled = false
  assert.deepEqual(availableRoles(account), ['TEACHER'])
  account.teacher!.permanentlyRejectedAt = new Date()
  assert.deepEqual(availableRoles(account), [])
  account.roles[2].isEnabled = true
  assert.deepEqual(availableRoles(account), ['SUPER_ADMIN'])
  account.isEnabled = false
  assert.deepEqual(availableRoles(account), [])
})
