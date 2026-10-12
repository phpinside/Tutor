/**
 * 生成工具模板缩略图（幂等，可重复执行）。
 * 运行：npx tsx prisma/generateTemplateThumbnails.ts
 *
 * 模板选择列表只加载缩略图，原图仅用于高清预览与导出：
 * - public/student-certificate-templates/*.{jpg,jpeg,png,webp} → <名>-thumb.jpg（最长边 480）
 * - public/case-image-templates/*.png → <名>-thumb.jpg（最长边 960；先铺白底避免透明区域变黑）
 * 缩略图均平铺在原目录（API 的 previewUrl 与 thumbnailPath 不支持子目录）。
 * 新增内置模板后重新运行本脚本即可。
 */
import { existsSync } from 'fs'
import { mkdir, readFile, readdir, writeFile } from 'fs/promises'
import path from 'path'
import { createCanvas, loadImage } from '@napi-rs/canvas'

const ROOT = path.join(process.cwd(), 'public')
const JPEG_QUALITY = 80

async function writeThumbnail(sourcePath: string, targetPath: string, maxEdge: number) {
  const image = await loadImage(await readFile(sourcePath))
  const scale = Math.min(1, maxEdge / Math.max(image.width, image.height))
  const width = Math.max(1, Math.round(image.width * scale))
  const height = Math.max(1, Math.round(image.height * scale))
  const canvas = createCanvas(width, height)
  const ctx = canvas.getContext('2d')
  // 先铺白底再画图，避免模板透明区域在 JPEG 中变成黑色
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, width, height)
  ctx.drawImage(image, 0, 0, width, height)
  await writeFile(targetPath, canvas.toBuffer('image/jpeg', JPEG_QUALITY))
  console.log(`✓ ${path.relative(ROOT, sourcePath)} → ${path.relative(ROOT, targetPath)} (${width}×${height}, ${(canvas.toBuffer('image/jpeg', JPEG_QUALITY).length / 1024).toFixed(0)}KB)`)
}

async function generate(dirName: string, options: { maxEdge: number; extensions: string[]; suffix: string }) {
  const dir = path.join(ROOT, dirName)
  if (!existsSync(dir)) return
  await mkdir(dir, { recursive: true })
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (!entry.isFile()) continue
    const ext = path.extname(entry.name).toLowerCase()
    if (!options.extensions.includes(ext) || entry.name.includes('-thumb.')) continue
    const base = path.basename(entry.name, ext)
    await writeThumbnail(path.join(dir, entry.name), path.join(dir, `${base}${options.suffix}.jpg`), options.maxEdge)
  }
}

async function main() {
  await generate('student-certificate-templates', { maxEdge: 480, extensions: ['.jpg', '.jpeg', '.png', '.webp'], suffix: '-thumb' })
  await generate('case-image-templates', { maxEdge: 960, extensions: ['.png'], suffix: '-thumb' })
}

main()
  .then(() => console.log('缩略图生成完成'))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
