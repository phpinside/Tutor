'use client'

import { useState, useRef, useEffect } from 'react'
import QRCode from 'qrcode'

type PosterGeneratorProps = {
  inviteUrl: string
  referrerName: string | null
  onClose: () => void
}

type Template = {
  id: string
  filename: string
  url: string
  name: string
}

export default function PosterGenerator({
  inviteUrl,
  referrerName,
  onClose
}: PosterGeneratorProps) {
  const [templates, setTemplates] = useState<Template[]>([])
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null)
  const [loadingTemplates, setLoadingTemplates] = useState(true)
  const [isGenerating, setIsGenerating] = useState(false)
  const [posterUrl, setPosterUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  // 加载模板列表
  useEffect(() => {
    loadTemplates()
  }, [])

  const loadTemplates = async () => {
    setLoadingTemplates(true)
    try {
      const response = await fetch('/api/poster-templates')
      const data = await response.json()
      
      if (data.templates && data.templates.length > 0) {
        setTemplates(data.templates)
        setSelectedTemplate(data.templates[0].url)
      } else {
        setTemplates([])
      }
    } catch (err) {
      console.error('加载模板列表失败:', err)
      setError('加载模板失败，请刷新重试')
    } finally {
      setLoadingTemplates(false)
    }
  }

  // 加载选中的模板图片
  const loadTemplate = (canvas: HTMLCanvasElement, templateUrl: string): Promise<boolean> => {
    return new Promise((resolve) => {
      const img = new Image()
      img.crossOrigin = 'anonymous'
      
      img.onload = () => {
        const ctx = canvas.getContext('2d')
        if (ctx) {
          canvas.width = 750
          canvas.height = 1334
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
          resolve(true)
        } else {
          resolve(false)
        }
      }
      
      img.onerror = () => {
        resolve(false)
      }
      
      img.src = templateUrl
    })
  }

  // 生成海报
  const generatePoster = async () => {
    if (!selectedTemplate) {
      setError('请先选择一个模板')
      return
    }

    setIsGenerating(true)
    setError(null)
    setPosterUrl(null)

    try {
      const canvas = canvasRef.current
      if (!canvas) {
        throw new Error('Canvas 元素未找到')
      }

      // 加载选中的模板
      const templateLoaded = await loadTemplate(canvas, selectedTemplate)
      if (!templateLoaded) {
        throw new Error('模板加载失败，请重试')
      }

      // 生成二维码
      const qrDataUrl = await QRCode.toDataURL(inviteUrl, {
        width: 200,
        margin: 0,
        color: {
          dark: '#000000',
          light: '#ffffff'
        }
      })

      // 加载二维码图片
      const qrImage = new Image()
      qrImage.crossOrigin = 'anonymous'
      
      await new Promise<void>((resolve, reject) => {
        qrImage.onload = () => resolve()
        qrImage.onerror = () => reject(new Error('二维码加载失败'))
        qrImage.src = qrDataUrl
      })

      // 绘制二维码到画布
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        throw new Error('Canvas context 获取失败')
      }

      // 在底部水平居中位置绘制二维码
      const qrSize = 200
      const qrBottomMargin = 100  // 距离底部的距离
      const qrX = (canvas.width - qrSize) / 2  // 水平居中
      const qrY = canvas.height - qrSize - qrBottomMargin  // 基于底部距离计算
      ctx.drawImage(qrImage, qrX, qrY, qrSize, qrSize)

      // 转换为图片 URL
      const dataUrl = canvas.toDataURL('image/png', 1.0)
      setPosterUrl(dataUrl)
    } catch (err) {
      console.error('生成海报失败:', err)
      setError(err instanceof Error ? err.message : '生成失败，请重试')
    } finally {
      setIsGenerating(false)
    }
  }

  // 下载海报
  const downloadPoster = () => {
    if (!posterUrl) return

    const link = document.createElement('a')
    link.href = posterUrl
    link.download = `邀请海报-${referrerName || '伴学老师'}-${Date.now()}.png`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-2 sm:p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[95vh] sm:max-h-[90vh] overflow-y-auto">
        {/* 标题栏 */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between rounded-t-2xl z-10">
          <h2 className="text-lg sm:text-xl font-bold text-gray-900">生成邀请海报</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            aria-label="关闭"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* 内容区域 */}
        <div className="p-4 sm:p-6">
          {/* 加载模板列表中 */}
          {loadingTemplates && (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-primary-600 mb-4"></div>
              <p className="text-gray-600">加载模板中...</p>
            </div>
          )}

          {/* 无模板情况 */}
          {!loadingTemplates && templates.length === 0 && (
            <div className="text-center py-12">
              <div className="text-6xl mb-4">📸</div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                还没有海报模板
              </h3>
              <p className="text-gray-600 mb-4">
                请先上传海报模板图片到 public/poster-templates/ 目录
              </p>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-left max-w-md mx-auto">
                <p className="text-sm text-blue-900 font-medium mb-2">上传步骤：</p>
                <ol className="text-sm text-blue-800 space-y-1 list-decimal list-inside">
                  <li>准备 750x1334px 的海报图片</li>
                  <li>命名为 template-1.png, template-2.png 等</li>
                  <li>上传到 public/poster-templates/ 目录</li>
                  <li>刷新页面即可使用</li>
                </ol>
              </div>
            </div>
          )}

          {/* 有模板时显示选择界面 */}
          {!loadingTemplates && templates.length > 0 && !posterUrl && (
            <div className="space-y-6">
              {/* 模板选择区域 */}
              <div>
                <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-4">
                  选择海报模板
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
                  {templates.map((template) => (
                    <div
                      key={template.id}
                      onClick={() => setSelectedTemplate(template.url)}
                      className={`
                        relative cursor-pointer rounded-lg overflow-hidden border-2 
                        transition-all hover:scale-105
                        ${selectedTemplate === template.url 
                          ? 'border-primary-600 ring-2 ring-primary-200' 
                          : 'border-gray-200 hover:border-gray-300'
                        }
                      `}
                    >
                      <img 
                        src={template.url} 
                        alt={template.name} 
                        className="w-full aspect-[9/16] object-cover"
                      />
                      {selectedTemplate === template.url && (
                        <div className="absolute top-2 right-2 bg-primary-600 text-white rounded-full p-1">
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        </div>
                      )}
                      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-2">
                        <p className="text-white text-xs sm:text-sm font-medium">{template.name}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* 生成按钮 */}
              <button
                onClick={generatePoster}
                disabled={!selectedTemplate || isGenerating}
                className="w-full bg-gradient-to-r from-primary-600 to-primary-700 hover:from-primary-700 hover:to-primary-800 text-white font-medium py-3 px-6 rounded-lg transition-all shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isGenerating ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                    <span>生成中...</span>
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <span>生成海报</span>
                  </>
                )}
              </button>
            </div>
          )}

          {/* 错误提示 */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
              <div className="flex items-center">
                <svg className="w-5 h-5 text-red-600 mr-2" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
                <span className="text-red-800">{error}</span>
              </div>
            </div>
          )}

          {/* 海报预览和下载 */}
          {posterUrl && !isGenerating && (
            <div className="space-y-4">
              {/* 海报预览 */}
              <div className="bg-gray-50 rounded-lg p-2 sm:p-4 flex justify-center">
                <img
                  src={posterUrl}
                  alt="邀请海报"
                  className="max-w-full h-auto rounded-lg shadow-lg"
                  style={{ maxHeight: '60vh' }}
                />
              </div>

              {/* 操作按钮 */}
              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  onClick={downloadPoster}
                  className="flex-1 bg-gradient-to-r from-primary-600 to-primary-700 hover:from-primary-700 hover:to-primary-800 text-white font-medium py-3 px-4 sm:px-6 rounded-lg transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  下载海报
                </button>
                <button
                  onClick={() => setPosterUrl(null)}
                  className="sm:w-auto px-4 sm:px-6 py-3 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors"
                >
                  重新选择
                </button>
              </div>

              {/* 提示信息 */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-start">
                  <svg className="w-5 h-5 text-blue-600 mr-2 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                  </svg>
                  <div className="text-sm text-blue-800">
                    <p className="font-medium mb-1">分享提示</p>
                    <ul className="list-disc list-inside space-y-1 text-blue-700">
                      <li>下载后可分享到微信、朋友圈等社交平台</li>
                      <li>好友扫描二维码即可通过你的邀请链接注册</li>
                      <li>可在邀请看板实时查看邀请进度</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 隐藏的 Canvas 元素 */}
        <canvas ref={canvasRef} className="hidden" />
      </div>
    </div>
  )
}
