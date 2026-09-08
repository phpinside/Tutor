import { PDFDocument } from 'pdf-lib'
import path from 'node:path'
import fs from 'node:fs'

export interface StampPosition {
  /** 公章左上角 X（PDF 点，原点左上） */
  x: number
  /** 公章左上角 Y（PDF 点，原点左上） */
  y: number
  /** 公章宽度（PDF 点），高度按图片比例自动计算 */
  width: number
  /** 目标页码，从 0 开始，默认第 1 页 */
  page?: number
}

/** 按魔数判断图片格式：pdf-lib 的 PNG 与 JPG 需要用不同的嵌入方法 */
function isJpegImage(bytes: Buffer): boolean {
  return bytes.length > 2 && bytes[0] === 0xff && bytes[1] === 0xd8
}

/**
 * 将公章图片覆盖到已有 PDF 的指定位置。
 * @param basePdf 基础 PDF（系统生成或用户上传）
 * @param position 公章位置（左上角坐标 + 宽度，原点为页面左上角）
 * @param stampImage 公章图片内容（PNG/JPG）；不传时使用系统默认公章 public/yishenger.png
 * @returns 覆盖公章后的新 PDF Buffer
 */
export async function overlayStampOnPdf(
  basePdf: Buffer,
  position: StampPosition,
  stampImage?: Buffer
): Promise<Buffer> {
  const sealBytes = stampImage ?? fs.readFileSync(path.join(process.cwd(), 'public', 'yishenger.png'))

  const doc = await PDFDocument.load(basePdf, { ignoreEncryption: true })
  const pages = doc.getPages()
  const pageIdx = Math.min(position.page ?? 0, pages.length - 1)
  const page = pages[pageIdx]
  const { height } = page.getSize()

  const image = isJpegImage(sealBytes) ? await doc.embedJpg(sealBytes) : await doc.embedPng(sealBytes)
  const scale = position.width / image.width
  const stampHeight = image.height * scale

  // 客户端坐标原点在左上，pdf-lib 原点在左下，需转换
  const yFromBottom = height - position.y - stampHeight

  page.drawImage(image, {
    x: position.x,
    y: yFromBottom,
    width: position.width,
    height: stampHeight,
  })

  const bytes = await doc.save()
  return Buffer.from(bytes)
}

/** 读取系统默认公章图片 Buffer（供客户端预览缩放参考）。 */
export function readStampImage(): Buffer {
  return fs.readFileSync(path.join(process.cwd(), 'public', 'yishenger.png'))
}
