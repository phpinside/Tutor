/**
 * 业务数据库自动备份脚本
 *
 * 用法：
 *   npm run db:backup                          # 默认：custom 格式（-Fc，压缩），保留最近 14 份
 *   npm run db:backup -- --format plain        # 导出为纯 SQL（.sql）
 *   npm run db:backup -- --out ./my-backups    # 自定义输出目录
 *   npm run db:backup -- --keep 30             # 保留最近 30 份，自动清理更旧的
 *
 * 行为：
 *   1. 读取 DATABASE_URL（优先环境变量，其次项目根目录 .env，兼容 .env.development）
 *   2. 用 Prisma 做连通性预检（表数量 / 库大小），失败则中止
 *   3. 调用 pg_dump 导出（密码走 PGPASSWORD 环境变量，不落命令行，避免 ps 泄露）
 *   4. 输出到 backups/<库名>_backup_<时间戳>.dump|.sql，打印耗时与文件大小
 *   5. 按 --keep 数量滚动清理旧备份
 *
 * 依赖：本机需安装 pg_dump（PostgreSQL 客户端工具）。
 *   macOS:  brew install libpq && brew link --force libpq
 *   Debian/Ubuntu: apt-get install postgresql-client
 *   Docker 兜底：docker run --rm postgres:16 pg_dump ...（脚本失败时会打印等价命令）
 */
import { spawnSync } from 'child_process'
import fs from 'fs'
import path from 'path'
import { PrismaClient } from '@prisma/client'

type BackupFormat = 'custom' | 'plain'
type DbConfig = {
  host: string
  port: string
  user: string
  password: string
  database: string
  sslmode?: string
}

// ——— .env 读取（不引入额外依赖；tsx 不会自动加载 .env） ———
function loadEnvFromFiles(): void {
  if (process.env.DATABASE_URL) return
  const candidates = ['.env', '.env.development', '.env.production']
  for (const file of candidates) {
    const envPath = path.resolve(process.cwd(), file)
    if (!fs.existsSync(envPath)) continue
    const content = fs.readFileSync(envPath, 'utf8')
    for (const rawLine of content.split(/\r?\n/)) {
      const line = rawLine.trim()
      if (!line || line.startsWith('#')) continue
      const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/)
      if (!match) continue
      let value = match[2].trim()
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1)
      }
      if (process.env[match[1]] === undefined) {
        process.env[match[1]] = value
      }
    }
    if (process.env.DATABASE_URL) break
  }
}

function parseDatabaseUrl(rawUrl: string): DbConfig {
  let url: URL
  try {
    url = new URL(rawUrl)
  } catch {
    throw new Error('DATABASE_URL 无法解析，请检查格式（postgres://user:pass@host:port/db）')
  }
  if (url.protocol !== 'postgres:' && url.protocol !== 'postgresql:') {
    throw new Error(`DATABASE_URL 协议非 PostgreSQL（当前 ${url.protocol}）`)
  }
  const database = decodeURIComponent(url.pathname.replace(/^\//, ''))
  if (!database) {
    throw new Error('DATABASE_URL 中缺少数据库名')
  }
  return {
    host: url.hostname,
    port: url.port || '5432',
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database,
    sslmode: url.searchParams.get('sslmode') ?? undefined,
  }
}

function parseArgs(argv: string[]): { format: BackupFormat; outDir: string; keep: number } {
  let format: BackupFormat = 'custom'
  let outDir = path.resolve(process.cwd(), 'backups')
  let keep = 14
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === '--format') {
      const value = argv[++i]
      if (value !== 'custom' && value !== 'plain') {
        throw new Error(`--format 仅支持 custom | plain，收到：${value}`)
      }
      format = value
    } else if (arg === '--out') {
      outDir = path.resolve(argv[++i])
    } else if (arg === '--keep') {
      const value = parseInt(argv[++i], 10)
      if (!Number.isFinite(value) || value < 1) {
        throw new Error(`--keep 需为正整数，收到：${value}`)
      }
      keep = value
    } else {
      throw new Error(`未知参数：${arg}（支持 --format / --out / --keep）`)
    }
  }
  return { format, outDir, keep }
}

/** 连通性预检：确认库可访问，并返回表数量与库大小，便于人工核对备份对象正确 */
async function precheck(prisma: PrismaClient): Promise<{ tables: number; size: string }> {
  const tableRows = await prisma.$queryRaw<{ count: number }[]>`
    SELECT count(*)::int AS count
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
  `
  const sizeRows = await prisma.$queryRaw<{ size: string }[]>`
    SELECT pg_size_pretty(pg_database_size(current_database())) AS size
  `
  return { tables: tableRows[0]?.count ?? 0, size: sizeRows[0]?.size ?? '未知' }
}

function runPgDump(cfg: DbConfig, outFile: string, format: BackupFormat): void {
  const args = [
    '--host', cfg.host,
    '--port', cfg.port,
    '--username', cfg.user,
    '--dbname', cfg.database,
    '--no-password', // 禁止交互式提示：自动化场景密码必须来自 PGPASSWORD
    format === 'plain' ? '--format=plain' : '--format=custom',
    '--file', outFile,
  ]
  if (cfg.sslmode) {
    args.push('--sslmode', cfg.sslmode)
  }

  const result = spawnSync('pg_dump', args, {
    env: { ...process.env, PGPASSWORD: cfg.password },
    stdio: ['ignore', 'inherit', 'inherit'],
  })

  if (result.error && (result.error as NodeJS.ErrnoException).code === 'ENOENT') {
    throw new Error(
      '未找到 pg_dump 命令。请安装 PostgreSQL 客户端：\n' +
        '  macOS: brew install libpq && brew link --force libpq\n' +
        '  Debian/Ubuntu: apt-get install postgresql-client\n' +
        `  或用 Docker 兜底：docker run --rm postgres:16 pg_dump --host=${cfg.host} --port=${cfg.port} --username=${cfg.user} --dbname=${cfg.database} > ${outFile}`
    )
  }
  if (result.error) {
    throw result.error
  }
  if (result.status !== 0) {
    throw new Error(`pg_dump 退出码 ${result.status}，备份失败（请检查上方错误输出与账号权限）`)
  }
}

function cleanupOldBackups(outDir: string, prefix: string, keep: number): void {
  const files = fs
    .readdirSync(outDir)
    .filter((f) => f.startsWith(prefix))
    .map((f) => ({ name: f, mtime: fs.statSync(path.join(outDir, f)).mtimeMs }))
    .sort((a, b) => b.mtime - a.mtime)

  for (const stale of files.slice(keep)) {
    fs.unlinkSync(path.join(outDir, stale.name))
    console.log(`🧹 已清理旧备份：${stale.name}`)
  }
}

async function main(): Promise<void> {
  const startedAt = Date.now()
  loadEnvFromFiles()

  const rawUrl = process.env.DATABASE_URL
  if (!rawUrl) {
    throw new Error('未找到 DATABASE_URL：请配置环境变量，或在项目根目录创建 .env 文件（参考 .env.example）')
  }
  const cfg = parseDatabaseUrl(rawUrl)
  const { format, outDir, keep } = parseArgs(process.argv.slice(2))

  console.log(`📋 目标数据库：${cfg.database} @ ${cfg.host}:${cfg.port}（用户 ${cfg.user}）`)

  // 连通性预检（同时确认 DATABASE_URL 指向的是预期业务库）
  const prisma = new PrismaClient()
  try {
    const { tables, size } = await precheck(prisma)
    console.log(`🔌 连接正常：public 下 ${tables} 张表，库大小 ${size}`)
    if (tables === 0) {
      throw new Error('目标库 public 下没有任何业务表——请确认 DATABASE_URL 指向业务库而非空库')
    }
  } finally {
    await prisma.$disconnect().catch(() => undefined)
  }

  // 导出
  const timestamp = new Date()
    .toISOString()
    .replace(/[-:]/g, '')
    .replace('T', '_')
    .slice(0, 15) // YYYYMMDD_HHMMSS（UTC，避免本地时区歧义）
  const prefix = `${cfg.database}_backup_`
  const ext = format === 'plain' ? 'sql' : 'dump'
  const outFile = path.join(outDir, `${prefix}${timestamp}.${ext}`)

  fs.mkdirSync(outDir, { recursive: true })
  console.log(`⏳ 开始导出（${format === 'plain' ? '纯 SQL' : 'custom 压缩格式'}）...`)
  runPgDump(cfg, outFile, format)

  const stat = fs.statSync(outFile)
  if (stat.size === 0) {
    throw new Error('备份文件为空，视为失败（请检查 pg_dump 输出）')
  }
  const seconds = ((Date.now() - startedAt) / 1000).toFixed(1)
  console.log(`✅ 备份完成：${outFile}`)
  console.log(`   大小 ${(stat.size / 1024 / 1024).toFixed(2)} MB，耗时 ${seconds}s`)

  cleanupOldBackups(outDir, prefix, keep)
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(`❌ ${error instanceof Error ? error.message : String(error)}`)
    process.exit(1)
  })
