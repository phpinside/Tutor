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

  const request = fetch(url).then(async (response) => {
    if (!response.ok) {
      const data = await response.json().catch(() => ({}))
      throw new Error(data.error || '预览加载失败')
    }
    return response.arrayBuffer()
  }).catch((error) => {
    previewPdfCache.delete(url)
    throw error
  })

  if (previewPdfCache.size >= 5) {
    const oldestKey = previewPdfCache.keys().next().value
    if (oldestKey) previewPdfCache.delete(oldestKey)
  }
  previewPdfCache.set(url, request)
  return request
}

export function preloadStampPreview(draftId: string, previewVersion: string | null) {
  void loadPdfJs().catch(() => undefined)
  void loadPreviewPdf(draftId, previewVersion).catch(() => undefined)
}

export default function StampPreviewModal({ draftId, previewVersion, title, onClose, onIssued }: Props) {
  const canvasRefs = useRef<Array<HTMLCanvasElement | null>>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [pageCount, setPageCount] = useState(0)
  const [pageWidth, setPageWidth] = useState(0)
  const [pageHeight, setPageHeight] = useState(0)
  const [scale, setScale] = useState(1)
  const [stamp, setStamp] = useState<StampState>({ left: 0, top: 0, width: 0 })
  const [stampWidthPt, setStampWidthPt] = useState(DEFAULT_STAMP_PT)
  const [issuing, setIssuing] = useState(false)
  const [actionError, setActionError] = useState('')
  const dragRef = useRef<{ startX: number; startY: number; origLeft: number; origTop: number } | null>(null)

  // 每页单独渲染，管理员在一个可滚动区域内预览完整 PDF；印章仍定位于第一页。
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError('')
    setPageCount(0)
    ;(async () => {
      try {
        const [data, pdfjs] = await Promise.all([loadPreviewPdf(draftId, previewVersion), loadPdfJs()])
        if (cancelled) return
        pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs'
        const document = await pdfjs.getDocument({ data: new Uint8Array(data.slice(0)) }).promise
        setPageCount(document.numPages)
        canvasRefs.current = []
        await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
        if (cancelled) return

        const maxWidth = Math.min(560, window.innerWidth - 80)
        for (let index = 0; index < document.numPages; index += 1) {
          const page = await document.getPage(index + 1)
          const baseViewport = page.getViewport({ scale: 1 })
          const pageScale = maxWidth / baseViewport.width
          const viewport = page.getViewport({ scale: pageScale })
          const canvas = canvasRefs.current[index]
          if (!canvas) throw new Error(`第 ${index + 1} 页预览容器加载失败`)
          canvas.width = Math.floor(viewport.width)
          canvas.height = Math.floor(viewport.height)
          const context = canvas.getContext('2d')
          if (!context) throw new Error(`第 ${index + 1} 页无法获取画布`)
          await page.render({ canvasContext: context, viewport, canvas }).promise
          if (index === 0) {
            setPageWidth(baseViewport.width)
            setPageHeight(baseViewport.height)
            setScale(pageScale)
            const stampWidth = DEFAULT_STAMP_PT * pageScale
            setStamp({ left: viewport.width - stampWidth - 24, top: viewport.height - stampWidth - 90, width: stampWidth })
          }
        }
        if (!cancelled) setLoading(false)
      } catch (renderError) {
        if (!cancelled) {
          setError(renderError instanceof Error ? renderError.message : '预览加载失败')
          setLoading(false)
        }
      }
    })()
    return () => { cancelled = true }
  }, [draftId, previewVersion])

  useEffect(() => {
    if (!scale) return
    setStamp((previous) => ({ ...previous, width: stampWidthPt * scale }))
  }, [stampWidthPt, scale])

  const onPointerDown = (event: React.PointerEvent) => {
    event.preventDefault()
    event.stopPropagation()
    ;(event.target as HTMLElement).setPointerCapture(event.pointerId)
    dragRef.current = { startX: event.clientX, startY: event.clientY, origLeft: stamp.left, origTop: stamp.top }
  }

  const onPointerMove = (event: React.PointerEvent) => {
    if (!dragRef.current) return
    const maxX = pageWidth * scale - stamp.width
    const maxY = pageHeight * scale - stamp.width
    setStamp((previous) => ({
      ...previous,
      left: Math.max(0, Math.min(maxX, dragRef.current!.origLeft + event.clientX - dragRef.current!.startX)),
      top: Math.max(0, Math.min(maxY, dragRef.current!.origTop + event.clientY - dragRef.current!.startY)),
    }))
  }

  const handleConfirm = async () => {
    if (!scale) return
    setActionError('')
    setIssuing(true)
    try {
      const result = await issueInternshipCertificate(draftId, {
        x: stamp.left / scale,
        y: stamp.top / scale,
        width: stamp.width / scale,
        page: 0,
      })
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="flex max-h-[94vh] w-full max-w-2xl flex-col rounded-xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-3">
          <h2 className="text-base font-semibold text-gray-900">{title}</h2>
          <button type="button" onClick={onClose} className="text-2xl leading-none text-gray-400 hover:text-gray-600">×</button>
        </div>

        <div className="flex-1 overflow-auto p-4">
          {actionError && <div className="mb-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{actionError}</div>}
          {error && <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</div>}
          {!error && loading && <div className="py-16 text-center text-gray-500"><div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-primary-600" />正在加载完整预览…</div>}
          {!error && (
            <div className={loading ? 'hidden' : undefined}>
              <p className="mb-2 text-sm text-gray-500">已加载完整 PDF（共 {pageCount} 页）。拖动第一页的公章到合适位置，调整大小后确认开具。</p>
              <div className="mb-3 flex items-center gap-3 text-sm text-gray-600">
                <span>公章大小</span>
                <input type="range" min={60} max={180} value={stampWidthPt} onChange={(event) => setStampWidthPt(Number(event.target.value))} className="flex-1" />
                <span className="w-12 text-right">{stampWidthPt}pt</span>
              </div>
              <div className="space-y-5">
                {Array.from({ length: pageCount }, (_, index) => (
                  <div key={index}>
                    <p className="mb-2 text-center text-xs text-gray-500">第 {index + 1} 页{index === 0 ? '（公章定位页）' : ''}</p>
                    <div className="relative mx-auto w-fit select-none rounded border border-gray-300 bg-gray-50 shadow-sm">
                      <canvas ref={(node) => { canvasRefs.current[index] = node }} className="block" />
                      {index === 0 && <img src="/yishenger.png" alt="公章" draggable={false} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={() => { dragRef.current = null }} className="absolute cursor-move touch-none" style={{ left: stamp.left, top: stamp.top, width: stamp.width, height: stamp.width }} />}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-gray-200 px-5 py-3">
          <button type="button" onClick={onClose} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">取消</button>
          <button type="button" onClick={handleConfirm} disabled={loading || !!error || issuing} className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-50">{issuing ? '开具中…' : '确认开具'}</button>
        </div>
      </div>
    </div>
  )
}
