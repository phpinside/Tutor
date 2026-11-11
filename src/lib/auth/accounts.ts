import bcrypt from 'bcryptjs'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import type { Role } from './policy'

export const accountInclude = { teacher: true, operator: true, roles: true } as const
export type AccountWithProfiles = Prisma.AccountGetPayload<{ include: typeof accountInclude }>
export function availableRoles(account: AccountWithProfiles): Role[] {
  if (!account.isEnabled) return []
  return account.roles.filter(grant => grant.isEnabled && (
    grant.role === 'SUPER_ADMIN' ||
    (grant.role === 'TEACHER' && account.teacher && !account.teacher.permanentlyRejectedAt) ||
    (account.operator?.isEnabled && account.operator.role === grant.role)
  )).map(grant => grant.role)
}

/** 同时更新过渡期业务密码，并撤销所有设备会话。 */
export async function changeAccountPassword(accountId: string, password: string) {
  if (password.length < 6 || password.length > 72) throw new Error('密码需为 6–72 位')
  const hash = await bcrypt.hash(password, 12)
  await prisma.$transaction(async tx => {
    await tx.account.update({ where: { id: accountId }, data: { passwordHash: hash } })
    await tx.teacher.updateMany({ where: { accountId }, data: { password: hash } })
    await tx.operator.updateMany({ where: { accountId }, data: { password: hash } })
    await tx.authSession.deleteMany({ where: { accountId } })
  })
}

/** 防止通过重置教练密码接管其关联的管理账号。 */
export async function canResetAccount(actorAccountId: string, actorRole: Role, targetAccountId: string) {
  if (actorRole === 'SUPER_ADMIN' || actorAccountId === targetAccountId) return true
  return await prisma.accountRole.count({ where: { accountId: targetAccountId, role: { not: 'TEACHER' } } }) === 0
}
