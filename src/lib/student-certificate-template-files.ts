import { randomUUID } from 'crypto'
import { access, mkdir, readFile, writeFile } from 'fs/promises'
import { join } from 'path'

const DIRECTORY = join(process.cwd(), 'public', 'student-certificate-templates')
const PREFIX = '/student-certificate-templates/'

export function certificateBackgroundFilePath(path: string): string | null {
  if (!/^\/student-certificate-templates\/[a-zA-Z0-9_-]+\.(png|jpe?g|webp)$/.test(path)) return null
  return join(DIRECTORY, path.slice(PREFIX.length))
}

export async function certificateBackgroundExists(path: string): Promise<boolean> {
  const file = certificateBackgroundFilePath(path)
  if (!file) return false
  try { await access(file); return true } catch { return false }
}

export async function saveCertificateBackground(buffer: Buffer, extension: 'png' | 'jpg' | 'webp'): Promise<string> {
  const filename = `upload-${randomUUID()}.${extension}`
  await mkdir(DIRECTORY, { recursive: true })
  await writeFile(join(DIRECTORY, filename), buffer, { flag: 'wx' })
  return `${PREFIX}${filename}`
}

export async function readCertificateBackground(path: string): Promise<Buffer> {
  const file = certificateBackgroundFilePath(path)
  if (!file) throw new Error('奖状底图路径无效')
  return readFile(file)
}
