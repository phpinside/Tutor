import { randomUUID } from 'crypto'
import { access, mkdir, readFile, writeFile } from 'fs/promises'
import { basename, extname, join } from 'path'

const DIRECTORY = join(process.cwd(), 'public', 'student-certificate-templates')
const PREFIX = '/student-certificate-templates/'

export function certificateBackgroundFilePath(path: string): string | null {
  if (!/^\/student-certificate-templates\/[a-zA-Z0-9_-]+\.(png|jpe?g|webp)$/.test(path)) return null
  return join(DIRECTORY, path.slice(PREFIX.length))
}

/** 由底图路径推导缩略图路径（同目录、-thumb 后缀 jpg）；底图路径无效时返回 null */
export function certificateThumbnailPathFor(backgroundPath: string): string | null {
  if (!certificateBackgroundFilePath(backgroundPath)) return null
  return `${PREFIX}${basename(backgroundPath, extname(backgroundPath))}-thumb.jpg`
}

/** 写入缩略图文件（路径须来自 certificateThumbnailPathFor） */
export async function saveCertificateThumbnail(buffer: Buffer, thumbnailPath: string): Promise<void> {
  const filename = thumbnailPath.slice(PREFIX.length)
  if (!/^[a-zA-Z0-9_-]+-thumb\.jpg$/.test(filename)) throw new Error('缩略图路径无效')
  await mkdir(DIRECTORY, { recursive: true })
  await writeFile(join(DIRECTORY, filename), buffer)
}

/** 读取缩略图文件；文件不存在时返回 null（调用方回退底图原图） */
export async function readCertificateThumbnail(thumbnailPath: string | null): Promise<Buffer | null> {
  if (!thumbnailPath?.startsWith(PREFIX)) return null
  const filename = thumbnailPath.slice(PREFIX.length)
  if (!/^[a-zA-Z0-9_-]+-thumb\.jpg$/.test(filename)) return null
  try {
    return await readFile(join(DIRECTORY, filename))
  } catch {
    return null
  }
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
