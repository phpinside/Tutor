'use client'

import { useState, useCallback } from 'react'

interface UploadOptions {
  teacherId: string
  taskIndex: number
  onSuccess?: (videoUrl: string) => void
  onError?: (error: string) => void
}

interface UploadState {
  isUploading: boolean
  progress: number
  error: string | null
}

export function useQiniuUpload(options: UploadOptions) {
  const { teacherId, taskIndex, onSuccess, onError } = options
  
  const [state, setState] = useState<UploadState>({
    isUploading: false,
    progress: 0,
    error: null
  })

  const uploadFile = useCallback(async (file: File) => {
    try {
      setState({
        isUploading: true,
        progress: 0,
        error: null
      })

      // 1. 获取上传token
      const tokenResponse = await fetch('/api/upload/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          teacherId,
          taskIndex,
          fileName: file.name
        })
      })

      if (!tokenResponse.ok) {
        const errorData = await tokenResponse.json()
        throw new Error(errorData.error || '获取上传凭证失败')
      }

      const { uploadToken, key, domain, uploadUrl } = await tokenResponse.json()
      
      console.log('上传参数:', { key, domain, uploadUrl })

      // 2. 构建FormData上传到七牛云
      const formData = new FormData()
      formData.append('file', file)
      formData.append('token', uploadToken)
      formData.append('key', key)

      // 3. 使用XMLHttpRequest上传以支持进度监听
      const videoUrl = await new Promise<string>((resolve, reject) => {
        const xhr = new XMLHttpRequest()

        // 监听上传进度
        xhr.upload.addEventListener('progress', (e) => {
          if (e.lengthComputable) {
            const percentComplete = Math.round((e.loaded / e.total) * 100)
            setState(prev => ({
              ...prev,
              progress: percentComplete
            }))
          }
        })

        // 监听上传完成
        xhr.addEventListener('load', () => {
          if (xhr.status === 200) {
            // 上传成功，返回视频URL
            const result = JSON.parse(xhr.responseText)
            const fullUrl = `${domain}/${result.key || key}`
            resolve(fullUrl)
          } else {
            // 解析错误详情
            let errorMsg = '上传失败，请重试'
            try {
              const errorData = JSON.parse(xhr.responseText)
              errorMsg = `上传失败: ${errorData.error || errorData.message || xhr.statusText} (状态码: ${xhr.status})`
              console.error('七牛云上传错误详情:', errorData)
            } catch (e) {
              errorMsg = `上传失败: ${xhr.statusText} (状态码: ${xhr.status})`
              console.error('七牛云上传错误响应:', xhr.responseText)
            }
            reject(new Error(errorMsg))
          }
        })

        // 监听上传错误
        xhr.addEventListener('error', () => {
          reject(new Error('网络错误，请检查网络连接'))
        })

        // 监听上传超时
        xhr.addEventListener('timeout', () => {
          reject(new Error('上传超时，请重试'))
        })

        // 开始上传
        xhr.open('POST', uploadUrl)
        xhr.timeout = 300000 // 5分钟超时
        xhr.send(formData)
      })

      // 4. 上传成功
      setState({
        isUploading: false,
        progress: 100,
        error: null
      })

      onSuccess?.(videoUrl)
      return videoUrl

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '上传失败，请重试'
      
      setState({
        isUploading: false,
        progress: 0,
        error: errorMessage
      })

      onError?.(errorMessage)
      throw error
    }
  }, [teacherId, taskIndex, onSuccess, onError])

  const reset = useCallback(() => {
    setState({
      isUploading: false,
      progress: 0,
      error: null
    })
  }, [])

  return {
    uploadFile,
    reset,
    ...state
  }
}

