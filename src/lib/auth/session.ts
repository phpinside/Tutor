import { randomBytes, createHash } from 'node:crypto'
import { cache } from 'react'
import { cookies } from 'next/headers'
import { prisma } from '@/lib/prisma'
import { type Role, SESSION_COOKIE } from './policy'
import { accountInclude, availableRoles } from './accounts'

export const hashToken = (token: string) => createHash('sha256').update(token).digest('hex')
const LEGACY_COOKIES = ['teacherId', 'operator_session', 'admin_session']

export const getCurrentSession = cache(async () => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return null
  const session = await prisma.authSession.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { account: { include: accountInclude } },
  })
  if (!session) return null
  if (session.expiresAt <= new Date() || !session.account.isEnabled) {
    await prisma.authSession.deleteMany({ where: { id: session.id } })
    return null
  }
  const { account } = session
  const roles = availableRoles(account)
  // 被撤销的当前角色不能保留权限，也不能默默提升到其他角色。
  if (!roles.includes(session.activeRole)) {
    await prisma.authSession.deleteMany({ where: { id: session.id } })
    return null
  }
  const name = session.activeRole === 'TEACHER' ? account.teacher!.name : session.activeRole === 'SUPER_ADMIN' ? account.name : account.operator!.name
  return { id: session.id, accountId: account.id, name, login: account.login,
    activeRole: session.activeRole, roles, teacherId: account.teacher?.id ?? null,
    operatorId: account.operator?.id ?? null, operatorName: account.operator?.name ?? null,
    defaultRole: account.defaultRole, lastRole: account.lastRole }
})

export async function startSession(accountId: string, role: Role, expectedPasswordHash?: string) {
  const cookieStore = await cookies()
  const previous = cookieStore.get(SESSION_COOKIE)?.value
  const token = randomBytes(32).toString('hex')
  const maxAge = role === 'TEACHER' ? 60 * 60 * 24 * 30 : 60 * 60 * 24 * 7
  await prisma.$transaction(async tx => {
    // 与密码重置串行，防止校验旧密码后并发创建出仍有效的会话。
    await tx.$queryRaw`SELECT "id" FROM "accounts" WHERE "id" = ${accountId} FOR UPDATE`
    const account = await tx.account.findUniqueOrThrow({ where: { id: accountId }, include: accountInclude })
    const roles = availableRoles(account)
    if (!roles.includes(role) || (expectedPasswordHash && account.passwordHash !== expectedPasswordHash)) throw new Error('账号状态已变化，请重新登录')
    if (!expectedPasswordHash) {
      const existing = previous ? await tx.authSession.findUnique({ where: { tokenHash: hashToken(previous) } }) : null
      if (!existing || existing.accountId !== accountId || existing.expiresAt <= new Date() || !roles.includes(existing.activeRole)) throw new Error('会话已失效，请重新登录')
    }
    if (previous) await tx.authSession.deleteMany({ where: { tokenHash: hashToken(previous) } })
    await tx.authSession.create({ data: { tokenHash: hashToken(token), accountId, activeRole: role, expiresAt: new Date(Date.now() + maxAge * 1000) } })
    await tx.account.update({ where: { id: accountId }, data: { lastRole: role } })
    await tx.authSession.deleteMany({ where: { accountId, expiresAt: { lt: new Date() } } })
  })
  for (const name of LEGACY_COOKIES) cookieStore.delete(name)
  cookieStore.set(SESSION_COOKIE, token, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge })
}

export async function endSession() {
  const cookieStore = await cookies()
  const token = cookieStore.get(SESSION_COOKIE)?.value
  if (token) await prisma.authSession.deleteMany({ where: { tokenHash: hashToken(token) } })
  cookieStore.delete(SESSION_COOKIE)
  for (const name of LEGACY_COOKIES) cookieStore.delete(name)
}

