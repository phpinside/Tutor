'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { submitTask } from '@/app/actions/task'
import type { TaskConfig } from '@/lib/config'

interface TaskTrainingProps {
  task: TaskConfig
  teacherId: string
  submission: any
}

// 模拟培训视频列表
const TRAINING_VIDEOS = {
  3: [ // 伴学系统
    { title: '伴学方法论', duration: 8, url: 'video1.mp4' },
    { title: '服务边界与禁止行为', duration: 6, url: 'video2.mp4' },
    { title: '引导式教学方法', duration: 6, url: 'video3.mp4' }
  ],
  5: [ // 1v1群消息培训
    { title: '1v1群的作用', duration: 5, url: 'video4.mp4' },
    { title: '和家长沟通确定上课时间', duration: 4, url: 'video5.mp4' },
    { title: '群名称规则和会议邀请', duration: 3, url: 'video6.mp4' },
    { title: '课前提醒和课后反馈', duration: 3, url: 'video7.mp4' }
  ]
}

export default function TaskTraining({ task, teacherId, submission }: TaskTrainingProps) {
  const router = useRouter()
  const [currentVideoIndex, setCurrentVideoIndex] = useState(0)
  const [watchedVideos, setWatchedVideos] = useState<Set<number>>(new Set())
  const [isSubmitting, setIsSubmitting] = useState(false)
  
  const videos = TRAINING_VIDEOS[task.index as keyof typeof TRAINING_VIDEOS] || []
  const allWatched = watchedVideos.size === videos.length
  
  // 标记视频为已观看
  const markAsWatched = (index: number) => {
    setWatchedVideos(prev => new Set(prev).add(index))
  }
  
  // 自动标记当前视频为已观看(模拟)
  useEffect(() => {
    const timer = setTimeout(() => {
      markAsWatched(currentVideoIndex)
    }, 2000) // 2秒后自动标记为已观看(实际应该监听视频播放完成)
    
    return () => clearTimeout(timer)
  }, [currentVideoIndex])
  
  const handleSubmit = async () => {
    if (!allWatched) {
      alert('请完整观看所有培训视频')
      return
    }
    
    setIsSubmitting(true)
    
    try {
      // 提交任务（会自动推进到下一个任务）
      const result = await submitTask(teacherId, task.index, {
        taskType: task.type,
        watchProgress: 100
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
    <div className="space-y-6">
      {/* 视频播放器 */}
      <div className="card">
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-gray-900">
            {videos[currentVideoIndex]?.title}
          </h2>
          <p className="text-sm text-gray-500">
            视频 {currentVideoIndex + 1} / {videos.length} · 约 {videos[currentVideoIndex]?.duration} 分钟
          </p>
        </div>
        
        <div className="aspect-video bg-gray-100 rounded-lg flex items-center justify-center mb-4">
          <div className="text-center text-gray-500">
            <svg className="w-16 h-16 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p>视频播放器</p>
            <p className="text-sm mt-1">(演示环境)</p>
          </div>
        </div>
        
        {/* 已观看标记 */}
        {watchedVideos.has(currentVideoIndex) && (
          <div className="flex items-center gap-2 text-success-600 text-sm mb-4">
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            <span>已观看完成</span>
          </div>
        )}
      </div>
      
      {/* 视频列表 */}
      <div className="card">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          培训内容
        </h3>
        <div className="space-y-2">
          {videos.map((video, index) => (
            <button
              key={index}
              onClick={() => setCurrentVideoIndex(index)}
              className={`w-full text-left p-3 rounded-lg border transition-all ${
                currentVideoIndex === index
                  ? 'border-primary-500 bg-primary-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${
                    watchedVideos.has(index)
                      ? 'bg-success-500 text-white'
                      : 'bg-gray-200 text-gray-600'
                  }`}>
                    {watchedVideos.has(index) ? '✓' : index + 1}
                  </span>
                  <span className="font-medium text-gray-900">{video.title}</span>
                </div>
                <span className="text-sm text-gray-500">{video.duration} 分钟</span>
              </div>
            </button>
          ))}
        </div>
        
        {/* 进度提示 */}
        <div className="mt-4 p-3 bg-gray-50 rounded-lg">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">观看进度</span>
            <span className={`font-semibold ${allWatched ? 'text-success-600' : 'text-primary-600'}`}>
              {watchedVideos.size} / {videos.length}
            </span>
          </div>
          <div className="progress-bar mt-2">
            <div 
              className="progress-fill"
              style={{ width: `${(watchedVideos.size / videos.length) * 100}%` }}
            />
          </div>
        </div>
      </div>
      
      {/* 提交按钮 */}
      <div className="flex gap-3">
        <button
          onClick={handleSubmit}
          disabled={!allWatched || isSubmitting}
          className="btn-primary flex-1"
        >
          {isSubmitting ? '提交中...' : allWatched ? '完成学习' : `请观看所有视频 (${watchedVideos.size}/${videos.length})`}
        </button>
      </div>
    </div>
  )
}

