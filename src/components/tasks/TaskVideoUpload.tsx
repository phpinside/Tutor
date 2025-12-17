'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { submitTask } from '@/app/actions/task'
import type { TaskConfig } from '@/lib/config'

interface TaskVideoUploadProps {
  task: TaskConfig
  teacherId: string
  submission: any
}

export default function TaskVideoUpload({ task, teacherId, submission }: TaskVideoUploadProps) {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [videoFile, setVideoFile] = useState<File | null>(null)
  const [videoUrl, setVideoUrl] = useState(submission?.videoUrl || '')
  
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      if (file.size > 100 * 1024 * 1024) { // 100MB限制
        alert('视频文件不能超过 100MB')
        return
      }
      setVideoFile(file)
      
      // 创建预览URL
      const url = URL.createObjectURL(file)
      setVideoUrl(url)
    }
  }
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!videoFile && !submission?.videoUrl) {
      alert('请上传视频')
      return
    }
    
    setIsSubmitting(true)
    
    try {
      // TODO: 实际项目中需要先上传视频到云存储,获取URL
      // 这里使用模拟URL
      const uploadedUrl = videoFile 
        ? `https://example.com/videos/${Date.now()}.mp4`
        : submission.videoUrl
      
      // 提交任务（视频类型需要审核，不会自动推进）
      const result = await submitTask(teacherId, task.index, {
        taskType: task.type,
        videoUrl: uploadedUrl
      })
      
      if (result.success) {
        // 返回首页
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
      
      {/* 温馨提示 */}
      <div className="card bg-blue-50 border-blue-200">
        <h3 className="font-semibold text-blue-900 mb-2">💡 温馨提示</h3>
        <ul className="space-y-1 text-sm text-blue-800">
          <li>• 不看颜值,不背稿,看真实表达</li>
          <li>• 思路清晰、引导式讲解即可</li>
          <li>• 手机录制即可,不需要专业设备</li>
          <li>• 建议横屏录制,确保声音清晰</li>
        </ul>
      </div>
      
      {/* 视频上传 */}
      <div className="card">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          📹 上传视频
        </h2>
        
        {videoUrl ? (
          <div className="space-y-4">
            <div className="aspect-video bg-gray-100 rounded-lg overflow-hidden">
              <video 
                src={videoUrl} 
                controls 
                className="w-full h-full"
              >
                您的浏览器不支持视频播放
              </video>
            </div>
            <button
              type="button"
              onClick={() => {
                setVideoFile(null)
                setVideoUrl('')
              }}
              className="btn-secondary w-full"
            >
              重新选择视频
            </button>
          </div>
        ) : (
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-8">
            <input
              type="file"
              accept="video/*"
              onChange={handleFileChange}
              className="hidden"
              id="video-upload"
            />
            <label
              htmlFor="video-upload"
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
        )}
      </div>
      
      {/* 提交按钮 */}
      <div className="flex gap-3">
        <button
          type="submit"
          disabled={isSubmitting || (!videoFile && !submission?.videoUrl)}
          className="btn-primary flex-1"
        >
          {isSubmitting ? '提交中...' : '提交视频'}
        </button>
      </div>
      
      {/* 说明 */}
      <p className="text-sm text-gray-500 text-center">
        提交后我们会尽快查看,并给你反馈 ~
      </p>
    </form>
  )
}

