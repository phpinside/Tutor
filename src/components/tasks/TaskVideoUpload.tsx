'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { submitTask } from '@/app/actions/task'
import { useQiniuUpload } from '@/lib/hooks/useQiniuUpload'
import type { TaskConfig } from '@/lib/config'
import { getTaskVideoUploadConfigs, type VideoUploadConfig } from '@/lib/config'

interface TaskVideoUploadProps {
  task: TaskConfig
  teacherId: string
  submission: any
  teacher?: { primarySubject?: string | null }
}

interface VideoState {
  file: File | null
  previewUrl: string
  uploadedUrl: string
}

// 辅助函数：将文本中的URL转换为可点击的链接
const renderTextWithLinks = (text: string) => {
  // 匹配URL的正则表达式
  const urlRegex = /(https?:\/\/[^\s]+)/g
  const parts = text.split(urlRegex)
  
  return parts.map((part, index) => {
    if (part.match(urlRegex)) {
      return (
        <a
          key={index}
          href={part}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary-600 hover:text-primary-700 underline break-all"
        >
          {part}
        </a>
      )
    }
    return <span key={index}>{part}</span>
  })
}

export default function TaskVideoUpload({ task, teacherId, submission, teacher }: TaskVideoUploadProps) {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  
  // Load video configurations for this task, customized by primary subject
  const videoConfigs = getTaskVideoUploadConfigs(task.index, teacher?.primarySubject)
  const isMultiVideo = videoConfigs.length > 1
  
  // Initialize video states from submission data or empty
  const [videos, setVideos] = useState<Record<string, VideoState>>(() => {
    const initial: Record<string, VideoState> = {}
    videoConfigs.forEach(config => {
      const urlKey = `${config.key}VideoUrl`
      const existingUrl = submission?.formData?.[urlKey] || ''
      initial[config.key] = {
        file: null,
        previewUrl: existingUrl,
        uploadedUrl: existingUrl
      }
    })
    return initial
  })
  
  // Create individual upload hooks for each possible video (call at top level)
  // We'll call hooks for all configured videos
  const uploadHook0 = useQiniuUpload({
    teacherId,
    taskIndex: task.index,
    onSuccess: (url) => {
      if (videoConfigs[0]) {
        const key = videoConfigs[0].key
        setVideos(prev => ({
          ...prev,
          [key]: { ...prev[key], uploadedUrl: url }
        }))
      }
    },
    onError: (error) => {
      alert(error)
    }
  })
  
  const uploadHook1 = useQiniuUpload({
    teacherId,
    taskIndex: task.index,
    onSuccess: (url) => {
      if (videoConfigs[1]) {
        const key = videoConfigs[1].key
        setVideos(prev => ({
          ...prev,
          [key]: { ...prev[key], uploadedUrl: url }
        }))
      }
    },
    onError: (error) => {
      alert(error)
    }
  })
  
  const uploadHook2 = useQiniuUpload({
    teacherId,
    taskIndex: task.index,
    onSuccess: (url) => {
      if (videoConfigs[2]) {
        const key = videoConfigs[2].key
        setVideos(prev => ({
          ...prev,
          [key]: { ...prev[key], uploadedUrl: url }
        }))
      }
    },
    onError: (error) => {
      alert(error)
    }
  })
  
  // Map hooks to video configs
  const allHooks = [uploadHook0, uploadHook1, uploadHook2]
  const uploadHooks: Record<string, typeof uploadHook0> = {}
  videoConfigs.forEach((config, index) => {
    if (allHooks[index]) {
      uploadHooks[config.key] = allHooks[index]
    }
  })
  
  // Handle file change for a specific video
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>, configKey: string) => {
    const file = e.target.files?.[0]
    if (file) {
      if (file.size > 100 * 1024 * 1024) {
        alert('视频文件不能超过 100MB')
        return
      }
      
      const previewUrl = URL.createObjectURL(file)
      setVideos(prev => ({
        ...prev,
        [configKey]: { file, previewUrl, uploadedUrl: '' }
      }))
      
      try {
        await uploadHooks[configKey].uploadFile(file)
      } catch (error) {
        console.error('上传失败:', error)
      }
    }
  }
  
  // Reset a specific video
  const resetVideo = (configKey: string) => {
    setVideos(prev => ({
      ...prev,
      [configKey]: { file: null, previewUrl: '', uploadedUrl: '' }
    }))
  }
  
  // Check if all videos are uploaded
  const allVideosUploaded = videoConfigs.every(config => videos[config.key]?.uploadedUrl)
  
  // Check if any video is currently uploading
  const isAnyUploading = videoConfigs.some(config => uploadHooks[config.key]?.isUploading)
  
  const doSubmit = async () => {
    setIsSubmitting(true)
    try {
      const formData: Record<string, string> = {}
      videoConfigs.forEach(config => {
        formData[`${config.key}VideoUrl`] = videos[config.key].uploadedUrl
      })
      const result = await submitTask(teacherId, task.index, {
        taskType: task.type,
        formData
      })
      if (result.success) {
        router.push('/onboarding')
        router.refresh()
      } else {
        alert(result.error || '提交失败,请重试')
      }
    } catch (error) {
      console.error('提交失败:', error)
      alert('提交失败,请重试')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!allVideosUploaded) {
      const count = videoConfigs.length
      alert(count > 1 ? `请上传所有${count}个视频后再提交` : '请上传视频后再提交')
      return
    }

    if (task.index === 4) {
      setShowConfirm(true)
      return
    }

    await doSubmit()
  }
  
  // Helper function to render video upload section
  const renderVideoUploadSection = (
    config: VideoUploadConfig,
    video: VideoState,
    isUploading: boolean,
    progress: number,
    error: string | null,
    inputId: string
  ) => {
    if (video.previewUrl) {
      return (
        <div className="space-y-4">
          <div className="aspect-video bg-gray-100 rounded-lg overflow-hidden">
            <video 
              src={video.previewUrl} 
              controls 
              className="w-full h-full"
            >
              您的浏览器不支持视频播放
            </video>
          </div>
          
          {/* 上传进度条 */}
          {isUploading && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm text-gray-600">
                <span>上传中...</span>
                <span>{progress}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-primary-500 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                ></div>
              </div>
            </div>
          )}
          
          {/* 上传成功提示 */}
          {video.uploadedUrl && !isUploading && (
            <div className="flex items-center gap-2 text-sm text-green-600">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span>视频上传成功</span>
            </div>
          )}
          
          {/* 上传错误提示 */}
          {error && (
            <div className="flex items-center gap-2 text-sm text-red-600">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
              <span>{error}</span>
            </div>
          )}
          
          <button
            type="button"
            onClick={() => resetVideo(config.key)}
            disabled={isUploading}
            className="btn-secondary w-full"
          >
            重新选择视频
          </button>
        </div>
      )
    }
    
    return (
      <div className="border-2 border-dashed border-gray-300 rounded-lg p-8">
        <input
          type="file"
          accept="video/*"
          onChange={(e) => handleFileChange(e, config.key)}
          className="hidden"
          id={inputId}
        />
        <label
          htmlFor={inputId}
          className="flex flex-col items-center cursor-pointer"
        >
          <svg className="w-12 h-12 text-gray-400 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
          </svg>
          <span className="text-sm font-medium text-gray-700 mb-1">
            点击上传视频
          </span>
          <span className="text-xs text-gray-500">
            支持 MP4、MOV 等格式,最大 100MB
          </span>
        </label>
      </div>
    )
  }
  
  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* 任务要求 */}
      <div className="card">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          📝 任务要求
        </h2>
        <ul className="space-y-2">
          {task.requirements.map((req, index) => (
            <li key={index} className="flex items-start gap-2 text-gray-700">
              <span className="text-primary-500 mt-1">•</span>
              <span>{req}</span>
            </li>
          ))}
        </ul>
      </div>
      
      {/* 动态渲染视频上传区域 */}
      {videoConfigs.map((config, index) => {
        const hook = uploadHooks[config.key]
        const video = videos[config.key]
        
        return (
          <div key={config.key} className="card">
            <h2 className="text-lg font-semibold text-gray-900 mb-2">
              {config.emoji} {isMultiVideo && `视频${index + 1}: `}{config.title}
            </h2>
            <div className="card bg-blue-50 border-blue-200 mb-4">
              <h3 className="font-semibold text-blue-900 mb-2">💡 拍摄建议</h3>
              <ul className="space-y-1 text-sm text-blue-800">
                {config.tips.map((tip, i) => (
                  <li key={i} className="break-words">• {renderTextWithLinks(tip)}</li>
                ))}
              </ul>
            </div>
            
            {renderVideoUploadSection(
              config,
              video,
              hook?.isUploading || false,
              hook?.progress || 0,
              hook?.error || null,
              `${config.key}-video-upload`
            )}
          </div>
        )
      })}
      
      {/* 提交按钮 */}
      <div className="flex gap-3">
        <button
          type="submit"
          disabled={isSubmitting || isAnyUploading || !allVideosUploaded}
          className="btn-primary flex-1"
        >
          {isSubmitting 
            ? '提交中...' 
            : isAnyUploading
            ? '上传中...' 
            : !allVideosUploaded
            ? (videoConfigs.length > 1 ? `请上传所有${videoConfigs.length}个视频` : '请上传视频')
            : '提交视频'}
        </button>
      </div>
      
      {/* 说明 */}
      <p className="text-sm text-gray-500 text-center">
        提交后我们会尽快查看,并给你反馈 ~
      </p>

      {/* Task 4 提交确认弹窗 */}
      {showConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center gap-3">
              <span className="text-3xl">⚠️</span>
              <h3 className="text-lg font-bold text-gray-900">提交前请确认</h3>
            </div>
            <p className="text-gray-700 leading-relaxed text-base">
              请务必确保视频试讲使用了<strong className="text-red-600">鼎伴学软件</strong>，否则审核将不予通过。
            </p>
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowConfirm(false)}
                className="flex-1 btn-secondary"
              >
                返回检查
              </button>
              <button
                type="button"
                onClick={() => { setShowConfirm(false); doSubmit() }}
                disabled={isSubmitting}
                className="flex-1 btn-primary"
              >
                确认无误，提交
              </button>
            </div>
          </div>
        </div>
      )}
    </form>
  )
}
