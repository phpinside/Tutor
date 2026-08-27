'use client'

import { useEffect, useRef, useState } from 'react'
import { issueInternshipCertificate } from '@/app/actions/internshipCertificate'

type Props = {
  draftId: string
  previewVersion: string | null
  title: string
  onClose: () => void
  onIssued: () => void
}

type StampState = { left: number; top: number; width: number }

const DEFAULT_STAMP_PT = 110

let pdfJsPromise: ReturnType<typeof importPdfJs> | null = null
const previewPdfCache = new Map<string, Promise<ArrayBuffer>>()

function importPdfJs() {
  return import('pdfjs-dist')
}

function getPreviewUrl(draftId: string, previewVersion: string | null) {
  const params = previewVersion ? `?v=${encodeURIComponent(previewVersion)}` : ''
  return `/api/admin/internship-certificates/${draftId}/preview${params}`
}

function loadPdfJs() {
  pdfJsPromise ??= importPdfJs().catch((error) => {
    pdfJsPromise = null
    throw error
  })
  return pdfJsPromise
}

function loadPreviewPdf(draftId: string, previewVersion: string | null) {
  const url = getPreviewUrl(draftId, previewVersion)
  const cached = previewPdfCache.get(url)
  if (cached) return cached

  const request = fetch(url).then(async (res) => {
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      throw new Error(data.error || '预览加载失败')
    }
    return res.arrayBuffer()
  }).catch((error) => {
    previewPdfCache.delete(url)
    throw error
  })

  // 只保留最近几份预览，避免管理员连续查看很多记录后占用过多内存。
  if (previewPdfCache.size >= 5) {
    const oldestKey = previewPdfCache.keys().next().value
    if (oldestKey) previewPdfCache.delete(oldestKey)
  }
  previewPdfCache.set(url, request)
  return request
}

/** 鼠标移到“开具证明”时提前并行加载 PDF 数据和渲染器。 */
export function preloadStampPreview(draftId: string, previewVersion: string | null) {
  void loadPdfJs().catch(() => undefined)
  void loadPreviewPdf(draftId, previewVersion).catch(() => undefined)
}

export default function StampPreviewModal({ draftId, previewVersion, title, onClose, onIssued }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [pageWidth, setPageWidth] = useState(0)
  const [pageHeight, setPageHeight] = useState(0)
  const [scale, setScale] = useState(1)
  const [stamp, setStamp] = useState<StampState>({ left: 0, top: 0, width: 0 })
  const [stampWidthPt, setStampWidthPt] = useState(DEFAULT_STAMP_PT)
  const [issuing, setIssuing] = useState(false)
  const [actionError, setActionError] = useState('')
  const dragRef = useRef<{ startX: number; startY: number; origLeft: number; origTop: number } | null>(null)

  // 加载并渲染 PDF 第 1 页
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError('')
    ;(async () => {
      try {
        // PDF 下载与 pdf.js 加载并行进行，避免两个大资源串行等待。
        const [data, pdfjs] = await Promise.all([
          loadPreviewPdf(draftId, previewVersion),
          loadPdfJs(),
        ])
        if (cancelled) return
        // 公章 worker 自托管（同源），避免外网 CDN 慢/不可达导致预览卡住
        pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs'
        // pdf.js 会把传入的 ArrayBuffer 转移给 worker；复制一份以保留内存缓存供再次打开。
        const doc = await pdfjs.getDocument({ data: new Uint8Array(data.slice(0)) }).promise
        const page = await doc.getPage(1)
        const viewport0 = page.getViewport({ scale: 1 })
        const pw = viewport0.width
        const ph = viewport0.height
        // 按容器宽度自适应
        const maxW = Math.min(560, window.innerWidth - 80)
        const s = maxW / pw
        const viewport = page.getViewport({ scale: s })
        const canvas = canvasRef.current
        if (!canvas) return
        canvas.width = Math.floor(viewport.width)
        canvas.height = Math.floor(viewport.height)
        const ctx = canvas.getContext('2d')
        if (!ctx) throw new Error('无法获取画布')
        await page.render({ canvasContext: ctx, viewport, canvas }).promise
        if (cancelled) return
        setPageWidth(pw)
        setPageHeight(ph)
        setScale(s)
        const stampW = DEFAULT_STAMP_PT * s
        setStamp({
          left: viewport.width - stampW - 24,
          top: viewport.height - stampW - 90,
          width: stampW,
        })
        setLoading(false)
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : '预览加载失败')
          setLoading(false)
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [draftId, previewVersion])

  // 印章尺寸随滑块变化
  useEffect(() => {
    if (!scale) return
    setStamp((prev) => ({ ...prev, width: stampWidthPt * scale }))
  }, [stampWidthPt, scale])

  const onPointerDown = (e: React.PointerEvent) => {
    e.preventDefault()
    e.stopPropagation()
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
    dragRef.current = { startX: e.clientX, startY: e.clientY, origLeft: stamp.left, origTop: stamp.top }
  }
  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragRef.current) return
    const dx = e.clientX - dragRef.current.startX
    const dy = e.clientY - dragRef.current.startY
    const maxX = (pageWidth * scale) - stamp.width
    const maxY = (pageHeight * scale) - stamp.width
    setStamp((prev) => ({
      ...prev,
      left: Math.max(0, Math.min(maxX, dragRef.current!.origLeft + dx)),
      top: Math.max(0, Math.min(maxY, dragRef.current!.origTop + dy)),
    }))
  }
  const onPointerUp = () => {
    dragRef.current = null
  }

  const handleConfirm = async () => {
    if (!scale) return
    setActionError('')
    setIssuing(true)
    try {
      const x = stamp.left / scale
      const y = stamp.top / scale
      const width = stamp.width / scale
      const result = await issueInternshipCertificate(draftId, { x, y, width, page: 0 })
      if (!result.success) {
        setActionError(result.error || '开具失败，请稍后重试')
        setIssuing(false)
        return
      }
      onIssued()
    } catch {
      setActionError('网络异常，请稍后重试')
      setIssuing(false)
    }
  }

  const containerW = pageWidth ? pageWidth * scale : 0
  const containerH = pageHeight ? pageHeight * scale : 0

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[94vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200">
          <h2 className="text-base font-semibold text-gray-900">{title}</h2>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
        </div>

        <div className="flex-1 overflow-auto p-4">
          {actionError && (
            <div className="mb-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{actionError}</div>
          )}
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</div>
          )}
          {!error && loading && (
            <div className="text-center py-16 text-gray-500">
              <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-primary-600" />
              正在加载预览…
            </div>
          )}
          {/* canvas 必须在 loading 阶段就挂载，否则 effect 渲染时 ref 永远为空。 */}
          {!error && (
            <div className={loading ? 'hidden' : undefined}>
              <p className="text-sm text-gray-500 mb-2">拖动公章到合适位置（通常覆盖“单位公章”字样），调整大小后确认开具。</p>
              <div className="flex items-center gap-3 mb-3 text-sm text-gray-600">
                <span>公章大小</span>
                <input
                  type="range"
                  min={60}
                  max={180}
                  value={stampWidthPt}
                  onChange={(e) => setStampWidthPt(Number(e.target.value))}
                  className="flex-1"
                />
                <span className="w-12 text-right">{stampWidthPt}pt</span>
              </div>
              <div
                ref={containerRef}
                className="relative mx-auto border border-gray-300 rounded shadow-sm bg-gray-50 select-none"
                style={{ width: containerW, height: containerH }}
              >
                <canvas ref={canvasRef} className="block" />
                <img
                  src="/yishenger.png"
                  alt="公章"
                  draggable={false}
                  onPointerDown={onPointerDown}
                  onPointerMove={onPointerMove}
                  onPointerUp={onPointerUp}
                  className="absolute cursor-move touch-none"
                  style={{ left: stamp.left, top: stamp.top, width: stamp.width, height: stamp.width }}
                />
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 px-5 py-3 border-t border-gray-200">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            取消
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={loading || !!error || issuing}
            className="px-4 py-2 rounded-lg bg-primary-600 text-sm font-medium text-white hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {issuing ? '开具中…' : '确认开具'}
          </button>
        </div>
      </div>
    </div>
  )
}
