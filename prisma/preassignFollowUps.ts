/**
 * 教练跟进人批量预分配脚本（统一分配模型）
 * =============================================================================
 * 目标：对指定起始日期后注册、当前仍在入驻流程中（NOT_STARTED / IN_PROGRESS）、
 *       既无 TeacherTeam（无跟进人）也无 CoachReview 的教师，
 *       按统一分配模型解析跟进人并创建 TeacherTeam，实现入驻期间的预分配。
 *
 * 复用生产逻辑：src/lib/externalTutor.ts 的 resolveFirstReviewerUnified /
 * assignFollowUpAtRegistration（与注册路径完全一致，保证「跟进人 = 初审人」）。
 *
 * 数据库与外部接口配置：启动时显式加载 项目根目录/.env（或 prisma/.env），
 * 读取 DATABASE_URL、EXTERNAL_TUTOR_API_URL、EXTERNAL_TUTOR_API_TOKEN；
 * 已存在的进程环境变量优先（如 export 或 Docker 注入的变量不会被覆盖）。
 *
 * 用法：
 *   npx tsx prisma/preassignFollowUps.ts                          # 默认起始日期 2025-06-01，直接执行
 *   npx tsx prisma/preassignFollowUps.ts --start=2025-09-01       # 指定起始日期
 *   npx tsx prisma/preassignFollowUps.ts --start=2025-09-01 --dry-run  # 试运行，仅预览不写库
 * =============================================================================
 */

import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { PrismaClient } from '@prisma/client'
import {
  assignFollowUpAtRegistration,
  resolveFirstReviewerUnified,
  REVIEW_ELIGIBLE_SINCE,
  type ResolveResult,
} from '../src/lib/externalTutor'

// ——— 显式加载 .env ———
// tsx 独立运行时不会像 Next.js 运行时那样自动读取 .env，需在此显式加载。
// 按 Next.js 的优先级顺序探测（先到先得，已存在的进程环境变量不被覆盖）：
//   .env.production.local > .env.local > .env.production > .env > prisma/.env
function loadEnvFile(filePath: string): boolean {
  if (!existsSync(filePath)) return false
  for (const rawLine of readFileSync(filePath, 'utf-8').split('\n')) {
    let line = rawLine.trim()
    if (!line || line.startsWith('#')) continue
    if (line.startsWith('export ')) line = line.slice(7).trim()
    const eq = line.indexOf('=')
    if (eq <= 0) continue
    const key = line.slice(0, eq).trim()
    let value = line.slice(eq + 1).trim()
    const quoted =
      (value.startsWith('"') && value.endsWith('"') && value.length >= 2) ||
      (value.startsWith("'") && value.endsWith("'") && value.length >= 2)
    if (quoted) {
      value = value.slice(1, -1)
    } else {
      // 未加引号的值：去掉行内注释（value # comment）
      const hash = value.indexOf(' #')
      if (hash >= 0) value = value.slice(0, hash).trim()
    }
    if (process.env[key] === undefined) {
      process.env[key] = value
    }
  }
  return true
}

const envLoadedFrom: string[] = []
for (const name of [
  '.env.production.local',
  '.env.local',
  '.env.production',
  '.env',
  'prisma/.env',
]) {
  const p = resolve(process.cwd(), name)
  if (loadEnvFile(p)) envLoadedFrom.push(p)
}

const prisma = new PrismaClient()

const SOURCE_LABELS: Record<string, string> = {
  team_assignment: '团队跟进人',
  api: '外部接口/组织架构',
  inviter_chain: '邀请人链条',
  random_assignment: '加权随机',
  merged: '未解析出（合并审核）',
}

function parseArgs() {
  const args = process.argv.slice(2)
  const dryRun = args.includes('--dry-run')
  const startArg = args.find((a) => a.startsWith('--start='))
  const startDate = startArg ? new Date(startArg.split('=')[1]) : REVIEW_ELIGIBLE_SINCE

  if (Number.isNaN(startDate.getTime())) {
    console.error('错误：无效的起始日期，请使用 --start=YYYY-MM-DD 格式')
    process.exit(1)
  }

  return { dryRun, startDate }
}

async function main() {
  const { dryRun, startDate } = parseArgs()

  console.log('=== 教练跟进人批量预分配 ===')
  if (envLoadedFrom.length > 0) {
    console.log(`已加载环境变量文件: ${envLoadedFrom.join(', ')}`)
  }
  if (!process.env.DATABASE_URL) {
    console.error(
      '错误: 未找到 DATABASE_URL 环境变量。\n' +
        '已探测: .env.production.local / .env.local / .env.production / .env / prisma/.env（当前目录）\n' +
        '请确认上述文件之一存在且包含 DATABASE_URL，\n' +
        '或先执行 export DATABASE_URL="postgresql://..." 后重试。'
    )
    process.exit(1)
  }
  console.log(`起始日期: ${startDate.toISOString().slice(0, 10)}`)
  console.log(`运行模式: ${dryRun ? '试运行（不写库）' : '正式执行'}`)
  if (!process.env.EXTERNAL_TUTOR_API_TOKEN) {
    console.warn('警告: EXTERNAL_TUTOR_API_TOKEN 未设置，外部接口层级将跳过，直接走邀请人链条/随机兜底')
  }

  // 查询候选教师：起始日期后注册 + 在入驻中 + 无跟进人 + 无审核记录
  const candidates = await prisma.teacher.findMany({
    where: {
      createdAt: { gte: startDate },
      status: { in: ['NOT_STARTED', 'IN_PROGRESS'] },
      teamAssignment: { is: null },
      coachReview: { is: null },
    },
    select: {
      id: true,
      name: true,
      phone: true,
      status: true,
      currentTaskIndex: true,
      createdAt: true,
      invitedBy: { select: { phone: true } },
      referredReferrals: {
        where: { type: 'DIRECT' },
        select: { referrer: { select: { phone: true } } },
        take: 1,
      },
    },
    orderBy: { createdAt: 'asc' },
  })

  // 附加信息：起始日期后已完成入驻但也无跟进人/审核记录的教师数量（仅提示，不在本脚本处理范围）
  const completedMissing = await prisma.teacher.count({
    where: {
      createdAt: { gte: startDate },
      status: 'COMPLETED',
      teamAssignment: { is: null },
      coachReview: { is: null },
    },
  })

  // 运营名称映射（用于输出可读的分配结果）
  const operators = await prisma.operator.findMany({
    select: { id: true, name: true },
  })
  const operatorNameById = new Map(operators.map((o) => [o.id, o.name]))

  console.log(`\n找到 ${candidates.length} 位待预分配的在入驻教师`)
  if (completedMissing > 0) {
    console.log(
      `提示: 另有 ${completedMissing} 位已完成入驻的教师同样无跟进人/审核记录，` +
        `不在本脚本范围（如需处理请通过管理端手动分配或 redistribute 接口）`
    )
  }

  if (candidates.length === 0) {
    console.log('\n无需分配，结束。')
    return
  }

  const summary: Record<string, number> = {}
  let failed = 0

  for (const teacher of candidates) {
    // 与 findDirectInviter 一致：优先 Referral 表，回退 Teacher.invitedById
    const inviterPhone =
      teacher.referredReferrals[0]?.referrer?.phone ?? teacher.invitedBy?.phone ?? null
    const inviterLabel = inviterPhone
      ? `邀请人:${inviterPhone}`
      : '无邀请人'

    if (dryRun) {
      // 试运行：仅解析不写库（外部接口调用可能耗时）
      const resolved = await resolveFirstReviewerUnified(teacher.id, inviterPhone)
      const target = resolved.operatorId
        ? `${operatorNameById.get(resolved.operatorId) ?? resolved.operatorId}`
        : '（未解析出运营）'
      console.log(
        `  [预览] ${teacher.name || teacher.id}（${teacher.phone}，任务${teacher.currentTaskIndex}/7，${inviterLabel}）→ ${target}（${SOURCE_LABELS[resolved.source] ?? resolved.source}）`
      )
      summary[resolved.source] = (summary[resolved.source] ?? 0) + 1
      continue
    }

    // 正式执行：复用注册路径的生产逻辑（解析 + 创建 TeacherTeam，skipDuplicates 防并发冲突）
    const resolved: ResolveResult | null = await assignFollowUpAtRegistration(
      teacher.id,
      inviterPhone
    )

    if (resolved === null) {
      failed++
      console.error(`  ✗ ${teacher.name || teacher.id}（${teacher.phone}）→ 分配执行失败，已记录日志`)
      continue
    }

    const target = resolved.operatorId
      ? `${operatorNameById.get(resolved.operatorId) ?? resolved.operatorId}`
      : '（未解析出运营，暂无跟进人）'
    console.log(
      `  ✓ ${teacher.name || teacher.id}（${teacher.phone}，${inviterLabel}）→ ${target}（${SOURCE_LABELS[resolved.source] ?? resolved.source}）`
    )
    summary[resolved.source] = (summary[resolved.source] ?? 0) + 1
  }

  console.log(`\n=== ${dryRun ? '试运行' : '预分配'}完成 ===`)
  console.log(`处理总数: ${candidates.length}`)
  for (const [source, count] of Object.entries(summary)) {
    console.log(`  ${SOURCE_LABELS[source] ?? source}: ${count}`)
  }
  if (failed > 0) {
    console.log(`  执行失败: ${failed}（详见上方错误日志，可重新运行本脚本重试）`)
  }
}

main()
  .catch((e) => {
    console.error('预分配失败:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
