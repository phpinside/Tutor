import fs from 'node:fs'
import path from 'node:path'
import util from 'node:util'

const LOG_FILE = process.env.LOG_FILE || 'logs/app.log'

const original = {
  log: console.log.bind(console),
  error: console.error.bind(console),
  warn: console.warn.bind(console),
}

let stream: fs.WriteStream | null = null

function getStream(): fs.WriteStream | null {
  if (stream) return stream
  try {
    const resolved = path.isAbsolute(LOG_FILE) ? LOG_FILE : path.join(process.cwd(), LOG_FILE)
    fs.mkdirSync(path.dirname(resolved), { recursive: true })
    stream = fs.createWriteStream(resolved, { flags: 'a' })
    stream.on('error', (err) => {
      original.error(`[fileLogger] 日志写入失败 (${resolved}):`, err)
      stream = null
    })
    return stream
  } catch (err) {
    original.error('[fileLogger] 日志文件初始化失败:', err)
    return null
  }
}

function formatArgs(args: unknown[]): string {
  return args
    .map((arg) => (arg instanceof Error ? (arg.stack ?? arg.message) : typeof arg === 'string' ? arg : util.inspect(arg, { depth: 5 })))
    .join(' ')
}

function appendLine(level: string, args: unknown[]) {
  const s = getStream()
  if (!s) return
  const timestamp = new Date().toISOString()
  s.write(`[${timestamp}] [${level}] ${formatArgs(args)}\n`)
}

export function initFileLogger() {
  appendLine('info', ['========== 服务启动 =========='])
  original.log(`[fileLogger] 日志输出到文件: ${path.isAbsolute(LOG_FILE) ? LOG_FILE : path.join(process.cwd(), LOG_FILE)}`)

  console.log = (...args: unknown[]) => {
    appendLine('log', args)
    original.log(...args)
  }
  console.info = (...args: unknown[]) => {
    appendLine('info', args)
    original.log(...args)
  }
  console.warn = (...args: unknown[]) => {
    appendLine('warn', args)
    original.warn(...args)
  }
  console.error = (...args: unknown[]) => {
    appendLine('error', args)
    original.error(...args)
  }

  process.on('uncaughtException', (err) => {
    original.error('[fileLogger] 未捕获异常:', err)
    appendLine('uncaughtException', [err])
  })
  process.on('unhandledRejection', (reason) => {
    original.error('[fileLogger] 未处理的 Promise 拒绝:', reason)
    appendLine('unhandledRejection', [reason])
  })
}
