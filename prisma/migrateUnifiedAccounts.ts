import { existsSync } from 'node:fs'
import { PrismaClient } from '@prisma/client'

if (!process.env.DATABASE_URL && existsSync('.env')) process.loadEnvFile('.env')
const db = new PrismaClient()
const apply = process.argv.includes('--apply')

async function main() {
  const [teachers, operators] = await Promise.all([
    db.teacher.findMany({ select: { id: true, name: true, phone: true, password: true, accountId: true } }),
    db.operator.findMany({ select: { id: true, name: true, phone: true, password: true, accountId: true, role: true } }),
  ])
  const byPhone = new Map<string, { teacher?: typeof teachers[number]; operator?: typeof operators[number] }>()
  for (const teacher of teachers) byPhone.set(teacher.phone, { ...byPhone.get(teacher.phone), teacher })
  for (const operator of operators) byPhone.set(operator.phone, { ...byPhone.get(operator.phone), operator })
  let eligible = 0, migrated = 0, linked = 0, conflicts = 0, invalid = 0
  for (const [phone, profiles] of byPhone) {
    const { teacher, operator } = profiles
    if ((!teacher || teacher.accountId) && (!operator || operator.accountId)) { linked++; continue }
    // 双档案必须经双方凭据验证；即使哈希看似相同也不自动合并。
    if ((teacher && operator) || phone === (process.env.ADMIN_USERNAME || 'admin')) {
      conflicts++
      console.log(JSON.stringify({ status: 'requires_verification', phone: `${phone.slice(0, 3)}****${phone.slice(-4)}`, teacherId: teacher?.id, operatorId: operator?.id }))
      continue
    }
    const profile = teacher ?? operator!
    if (!/^1[3-9]\d{9}$/.test(phone) || !/^\$2[aby]\$\d{2}\$/.test(profile.password)) { invalid++; console.log(JSON.stringify({ status: 'invalid_legacy_account', profileId: profile.id })); continue }
    const existing = await db.account.findUnique({ where: { login: phone } })
    if (existing) { conflicts++; console.log(JSON.stringify({ status: 'login_conflict', profileId: profile.id })); continue }
    eligible++
    if (apply) {
      await db.$transaction(async tx => {
        const role = teacher ? 'TEACHER' as const : operator!.role
        const account = await tx.account.create({ data: { login: phone, name: profile.name, passwordHash: profile.password, defaultRole: role, roles: { create: { role } } } })
        const result = teacher
          ? await tx.teacher.updateMany({ where: { id: profile.id, accountId: null, password: profile.password }, data: { accountId: account.id } })
          : await tx.operator.updateMany({ where: { id: profile.id, accountId: null, password: profile.password }, data: { accountId: account.id } })
        if (result.count !== 1) throw new Error(`档案状态已变化：${profile.id}，请重跑检查`)
      })
      migrated++
    }
  }
  console.log(JSON.stringify({ mode: apply ? 'apply' : 'dry-run', eligible, migrated, alreadyLinked: linked, conflicts, invalid }))
}
main().catch(error => { console.error(error instanceof Error ? error.message : '迁移失败'); process.exitCode = 1 }).finally(() => db.$disconnect())
