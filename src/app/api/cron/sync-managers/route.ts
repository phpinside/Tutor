import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { recordAudit } from '@/lib/auditLog'
import { fetchExternalManagers } from '@/lib/externalManagers'

const CRON_SECRET = process.env.CRON_SECRET
const DEFAULT_NEW_MANAGER_PASSWORD = '123qwe@huabei'
const ACTOR_ID = 'cron_sync_managers'
const ACTOR_NAME = '系统学管名单同步'

type SyncSummary = {
  externalTotal: number
  matched: number
  phoneUpdated: Array<{ name: string; from: string; to: string }>
  banned: Array<{ name: string; phone: string }>
  created: Array<{ name: string; phone: string; positionName: string | null }>
  skipped: string[]
  failed: string[]
}

function normalizeName(raw: string): string {
  return raw.replace(/\s+/g, '')
}

function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, '')
  if (digits.length > 11 && digits.startsWith('86')) {
    return digits.slice(2)
  }
  return digits
}

function groupBy<T>(items: T[], key: (item: T) => string): Map<string, T[]> {
  const map = new Map<string, T[]>()
  for (const item of items) {
    const k = key(item)
    const list = map.get(k)
    if (list) {
      list.push(item)
    } else {
      map.set(k, [item])
    }
  }
  return map
}

async function syncManagers(): Promise<SyncSummary> {
  const summary: SyncSummary = {
    externalTotal: 0,
    matched: 0,
    phoneUpdated: [],
    banned: [],
    created: [],
    skipped: [],
    failed: [],
  }

  const external = await fetchExternalManagers()
  if (!external.success) {
    summary.failed.push(`获取外部学管名单失败: ${external.error}`)
    return summary
  }

  const extManagers = external.managers
    .map((m) => ({ ...m, name: normalizeName(m.name), phone: normalizePhone(m.phone) }))
    .filter((m) => {
      if (m.name && m.phone.length >= 7) return true
      summary.skipped.push(`跳过无效名单数据: name=${m.name}, phone=${m.phone}`)
      return false
    })
  summary.externalTotal = extManagers.length

  if (extManagers.length === 0) {
    summary.failed.push('外部学管名单为空，为避免误封禁已跳过本次同步')
    return summary
  }

  const operators = await prisma.operator.findMany({
    select: { id: true, name: true, phone: true, isEnabled: true },
  })

  const unmatchedExt = new Set(extManagers.map((_, index) => index))
  const matchedByName = new Map<string, number>()
  const matchedByPhone = new Map<string, number>()
  const ambiguousOpIds = new Set<string>()

  const extByName = groupBy(
    extManagers.map((m, index) => ({ m, index })),
    ({ m }) => m.name
  )

  for (const op of operators) {
    const candidates = (extByName.get(normalizeName(op.name)) ?? []).filter(
      ({ index }) => unmatchedExt.has(index)
    )
    if (candidates.length === 1) {
      matchedByName.set(op.id, candidates[0].index)
      unmatchedExt.delete(candidates[0].index)
    } else if (candidates.length > 1) {
      ambiguousOpIds.add(op.id)
      summary.skipped.push(`外部名单存在多个同名学管，跳过姓名匹配: ${op.name}`)
    }
  }

  const extByPhone = groupBy(
    [...unmatchedExt].map((index) => ({ m: extManagers[index], index })),
    ({ m }) => m.phone
  )

  for (const op of operators) {
    if (matchedByName.has(op.id)) continue
    const candidates = (extByPhone.get(normalizePhone(op.phone)) ?? []).filter(
      ({ index }) => unmatchedExt.has(index)
    )
    if (candidates.length === 1) {
      matchedByPhone.set(op.id, candidates[0].index)
      unmatchedExt.delete(candidates[0].index)
    } else if (candidates.length > 1) {
      ambiguousOpIds.add(op.id)
      summary.skipped.push(`外部名单存在多个同手机号学管，跳过手机号匹配: ${op.name}(${op.phone})`)
    }
  }

  summary.matched = matchedByName.size + matchedByPhone.size

  for (const op of operators) {
    if (matchedByName.has(op.id) || matchedByPhone.has(op.id)) continue
    if (ambiguousOpIds.has(op.id)) {
      summary.skipped.push(`匹配存在歧义，跳过自动封禁，请人工核查: ${op.name}(${op.phone})`)
      continue
    }
    if (!op.isEnabled) {
      summary.skipped.push(`账号已禁用且不在名单中: ${op.name}(${op.phone})`)
      continue
    }
    await prisma.operator.update({
      where: { id: op.id },
      data: { isEnabled: false },
    })
    summary.banned.push({ name: op.name, phone: op.phone })
    await recordAudit({
      actorType: 'SYSTEM',
      actorId: ACTOR_ID,
      actorName: ACTOR_NAME,
      action: 'DISABLE_OPERATOR',
      targetType: 'OPERATOR',
      targetId: op.id,
      detail: { name: op.name, phone: op.phone, reason: '不在外部学管名单中' },
    })
  }

  const operatorsById = new Map(operators.map((op) => [op.id, op]))

  const pendingPhoneUpdates = new Map<string, string>()
  for (const [opId, extIndex] of matchedByName) {
    const op = operatorsById.get(opId)
    if (!op) continue
    const ext = extManagers[extIndex]
    if (normalizePhone(op.phone) !== ext.phone) {
      pendingPhoneUpdates.set(opId, ext.phone)
    }
  }

  const finalPhones = new Map<string, string>()
  for (const op of operators) {
    finalPhones.set(op.id, pendingPhoneUpdates.get(op.id) ?? normalizePhone(op.phone))
  }

  const updateDependencies = new Map<string, string[]>()
  for (const [opId, newPhone] of pendingPhoneUpdates) {
    const holder = operators.find(
      (other) => other.id !== opId && normalizePhone(other.phone) === newPhone
    )
    if (holder && pendingPhoneUpdates.has(holder.id)) {
      updateDependencies.set(opId, [...(updateDependencies.get(opId) ?? []), holder.id])
    }
  }

  const executedUpdates = new Set<string>()
  let progress = true
  while (executedUpdates.size < pendingPhoneUpdates.size && progress) {
    progress = false
    for (const [opId, newPhone] of pendingPhoneUpdates) {
      if (executedUpdates.has(opId)) continue
      const deps = updateDependencies.get(opId) ?? []
      if (!deps.every((depId) => executedUpdates.has(depId))) continue

      const op = operatorsById.get(opId)
      if (!op) {
        executedUpdates.add(opId)
        progress = true
        continue
      }

      const conflictOp = operators.find(
        (other) => other.id !== opId && finalPhones.get(other.id) === newPhone
      )
      if (conflictOp) {
        summary.failed.push(
          `更新手机号失败: ${op.name}(${op.phone}) → ${newPhone}, 目标手机号已被账号 ${conflictOp.name}(${conflictOp.phone}) 占用`
        )
        executedUpdates.add(opId)
        progress = true
        continue
      }

      try {
        await prisma.operator.update({
          where: { id: opId },
          data: { phone: newPhone },
        })
        summary.phoneUpdated.push({ name: op.name, from: op.phone, to: newPhone })
        await recordAudit({
          actorType: 'SYSTEM',
          actorId: ACTOR_ID,
          actorName: ACTOR_NAME,
          action: 'UPDATE_OPERATOR_PHONE',
          targetType: 'OPERATOR',
          targetId: opId,
          detail: { name: op.name, from: op.phone, to: newPhone, source: 'external_managers_api' },
        })
      } catch (error) {
        summary.failed.push(
          `更新手机号失败: ${op.name}(${op.phone}) → ${newPhone}, 原因: ${
            error instanceof Error ? error.message : String(error)
          }`
        )
      }
      executedUpdates.add(opId)
      progress = true
    }
  }

  for (const [opId, newPhone] of pendingPhoneUpdates) {
    if (executedUpdates.has(opId)) continue
    const op = operatorsById.get(opId)
    if (op) {
      summary.failed.push(
        `更新手机号失败: ${op.name}(${op.phone}) → ${newPhone}, 存在换号依赖环，需人工处理`
      )
    }
  }

  const defaultHashedPassword = await bcrypt.hash(DEFAULT_NEW_MANAGER_PASSWORD, 10)

  for (const extIndex of unmatchedExt) {
    const ext = extManagers[extIndex]
    const conflict = await prisma.operator.findUnique({
      where: { phone: ext.phone },
      select: { id: true },
    })
    if (conflict) {
      summary.failed.push(`新增学管失败: ${ext.name}(${ext.phone}), 手机号已被现有账号占用`)
      continue
    }

    try {
      const operator = await prisma.operator.create({
        data: {
          name: ext.name,
          phone: ext.phone,
          password: defaultHashedPassword,
          role: 'LEARNER_MANAGER',
          isEnabled: true,
          remarks: ext.positionName?.trim() || null,
        },
      })
      summary.created.push({
        name: ext.name,
        phone: ext.phone,
        positionName: ext.positionName ?? null,
      })
      await recordAudit({
        actorType: 'SYSTEM',
        actorId: ACTOR_ID,
        actorName: ACTOR_NAME,
        action: 'CREATE_OPERATOR',
        targetType: 'OPERATOR',
        targetId: operator.id,
        detail: {
          name: ext.name,
          phone: ext.phone,
          positionName: ext.positionName,
          source: 'external_managers_api',
        },
      })
    } catch (error) {
      summary.failed.push(
        `新增学管失败: ${ext.name}(${ext.phone}), 原因: ${
          error instanceof Error ? error.message : String(error)
        }`
      )
    }
  }

  return summary
}

function verifyCronSecret(request: NextRequest): boolean {
  if (!CRON_SECRET) {
    return process.env.NODE_ENV === 'development'
  }

  const authHeader = request.headers.get('authorization')
  if (authHeader === `Bearer ${CRON_SECRET}`) {
    return true
  }

  const cronAuth = request.headers.get('x-vercel-cron-secret')
  if (cronAuth === CRON_SECRET) {
    return true
  }

  return false
}

export async function GET(request: NextRequest) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  console.log('开始执行学管名单同步任务...', new Date().toISOString())

  try {
    const summary = await syncManagers()

    console.log('学管名单同步任务完成:', {
      externalTotal: summary.externalTotal,
      matched: summary.matched,
      phoneUpdated: summary.phoneUpdated.length,
      banned: summary.banned.length,
      created: summary.created.length,
      skipped: summary.skipped.length,
      failed: summary.failed.length,
    })

    return NextResponse.json({
      success: summary.failed.length === 0,
      data: {
        ...summary,
        timestamp: new Date().toISOString(),
      },
    })
  } catch (error) {
    console.error('学管名单同步任务执行异常:', error)
    return NextResponse.json(
      {
        success: false,
        error: `同步任务执行异常: ${error instanceof Error ? error.message : String(error)}`,
      },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  return GET(request)
}
