'use client'

import { useState } from 'react'
import Image from 'next/image'

export default function QRCodeUploader() {
  const [uploading, setUploading] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string>('/qrcode-wechat-group.png')
  const [imageKey, setImageKey] = useState(Date.now()) // 用于强制刷新图片

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // 验证文件类型
    const validTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp']
    if (!validTypes.includes(file.type)) {
      setMessage({ type: 'error', text: '只支持 PNG、JPG、JPEG、WEBP 格式的图片' })
      return
    }

    // 验证文件大小（最大 5MB）
    const maxSize = 5 * 1024 * 1024
    if (file.size > maxSize) {
      setMessage({ type: 'error', text: '文件大小不能超过 5MB' })
      return
    }

    // 上传文件
    setUploading(true)
    setMessage(null)

    try {
      const formData = new FormData()
      formData.append('file', file)

      const response = await fetch('/api/upload/qrcode', {
        method: 'POST',
        body: formData,
      })

      const data = await response.json()

      if (response.ok) {
        setMessage({ type: 'success', text: '二维码上传成功！' })
        // 强制刷新图片（添加时间戳参数）
        setImageKey(Date.now())
        setPreviewUrl(`/qrcode-wechat-group.png?t=${Date.now()}`)
        
        // 3秒后清除成功消息
        setTimeout(() => setMessage(null), 3000)
      } else {
        setMessage({ type: 'error', text: data.error || '上传失败' })
      }
    } catch (error) {
      console.error('上传错误:', error)
      setMessage({ type: 'error', text: '上传失败，请重试' })
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="card">
      <div className="grid md:grid-cols-2 gap-6">
        {/* 左侧：当前二维码预览 */}
        <div>
          <h3 className="text-sm font-medium text-gray-700 mb-3">当前二维码</h3>
          <div className="bg-gray-50 rounded-lg p-6 flex items-center justify-center border-2 border-gray-200">
            <div className="w-64 h-64 relative bg-white rounded-lg shadow-sm">
              <Image
                key={imageKey}
                src={previewUrl}
                alt="微信群二维码"
                fill
                className="object-contain p-2"
                unoptimized
                onError={() => {
                  // 如果图片加载失败，显示占位符
                  setPreviewUrl('')
                }}
              />
              {!previewUrl && (
                <div className="absolute inset-0 flex items-center justify-center text-gray-400">
                  <div className="text-center">
                    <svg className="w-16 h-16 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <p className="text-sm">暂无二维码</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 右侧：上传操作 */}
        <div>
          <h3 className="text-sm font-medium text-gray-700 mb-3">上传新二维码</h3>
          <div className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <svg className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div className="text-sm text-blue-800">
                  <p className="font-medium mb-1">上传说明</p>
                  <ul className="space-y-1 text-xs">
                    <li>• 支持格式：PNG、JPG、JPEG、WEBP</li>
                    <li>• 文件大小：最大 5MB</li>
                    <li>• 建议尺寸：400x400 像素或更大</li>
                    <li>• 上传后会替换当前二维码</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* 上传按钮 */}
            <div>
              <label
                htmlFor="qrcode-upload"
                className={`
                  block w-full text-center px-6 py-8 border-2 border-dashed rounded-lg
                  cursor-pointer transition-all
                  ${uploading ? 'border-gray-300 bg-gray-50 cursor-not-allowed' : 'border-primary-300 bg-primary-50 hover:border-primary-400 hover:bg-primary-100'}
                `}
              >
                <input
                  id="qrcode-upload"
                  type="file"
                  accept="image/png,image/jpeg,image/jpg,image/webp"
                  onChange={handleFileChange}
                  disabled={uploading}
                  className="hidden"
                />
                <div className="flex flex-col items-center">
                  {uploading ? (
                    <>
                      <svg className="animate-spin h-10 w-10 text-primary-600 mb-3" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      <p className="text-sm text-gray-600">上传中...</p>
                    </>
                  ) : (
                    <>
                      <svg className="w-10 h-10 text-primary-600 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                      </svg>
                      <p className="text-sm font-medium text-gray-900 mb-1">点击选择图片</p>
                      <p className="text-xs text-gray-500">或拖拽图片到这里</p>
                    </>
                  )}
                </div>
              </label>
            </div>

            {/* 提示消息 */}
            {message && (
              <div
                className={`
                  p-4 rounded-lg border
                  ${message.type === 'success' ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-800'}
                `}
              >
                <div className="flex items-center gap-2">
                  {message.type === 'success' ? (
                    <svg className="w-5 h-5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                  )}
                  <p className="text-sm font-medium">{message.text}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}


