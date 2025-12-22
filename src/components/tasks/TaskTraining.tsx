'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import { submitTask, getTaskVideos, getVideoUrl } from '@/app/actions/task'
import type { TaskConfig, VideoConfig } from '@/lib/config'

// 动态导入 VideoPlayer，禁用 SSR
const VideoPlayer = dynamic(() => import('@/components/ui/VideoPlayer'), {
  ssr: false,
  loading: () => (
    <div className="aspect-video bg-gray-100 rounded-lg flex items-center justify-center">
      <div className="text-center text-gray-500">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-400 mx-auto mb-2"></div>
        <p>加载播放器...</p>
      </div>
    </div>
  )
})

interface TaskTrainingProps {
  task: TaskConfig
  teacherId: string
  submission: any
}

// 培训任务的说明内容配置
const TRAINING_CONTENT = {
  3: {
    title: '伴学系统培训',
    sections: [
      {
        title: '伴学方法论',
        points: [
          '引导式提问：通过问题启发学生思考，而不是直接给答案',
          '陪伴式学习：成为学生的学习伙伴，建立信任关系',
          '思维训练：培养学生的数学思维能力，而非单纯刷题'
        ]
      },
      {
        title: '服务边界与禁止行为',
        points: [
          '禁止：直接给学生答案、代写作业',
          '禁止：与家长发生经济纠纷、私下收费',
          '禁止：对学生进行负面评价、打击自信',
          '提倡：耐心引导、鼓励式教学、及时反馈'
        ]
      },
      {
        title: '引导式教学方法',
        points: [
          '第一步：了解学生的思路，"你是怎么想的？"',
          '第二步：找出思维断点，"卡在哪里了？"',
          '第三步：提供思维支架，"你觉得这样行不行？"',
          '第四步：让学生自己完成，"现在试试看"'
        ]
      }
    ]
  },
  5: {
    title: '1v1群消息培训',
    sections: [
      {
        title: '1v1群的作用和规则',
        points: [
          '作用：课前提醒、课后反馈、日常沟通的主要渠道',
          '成员：学生、家长、老师三方',
          '规则：及时回复、礼貌用语、专业形象'
        ]
      },
      {
        title: '课前提醒（上课前3小时）',
        points: [
          '提醒上课时间和准备事项',
          '例：[家长称呼]您好，今晚8点有一节数学课，请提醒[学生]准备好笔记本和草稿纸',
          '确认学生能否准时上课'
        ]
      },
      {
        title: '课后反馈（课后30分钟内）',
        points: [
          '本节课学习内容总结',
          '学生表现和进步点（鼓励为主）',
          '需要注意的问题和建议',
          '下节课计划'
        ]
      },
      {
        title: '群名称规则和会议邀请',
        points: [
          '群名称格式：[学生姓名]-数学伴学',
          '会议邀请：提前5分钟发送腾讯会议链接',
          '会议号：固定使用个人会议室，方便记忆'
        ]
      }
    ]
  }
}

export default function TaskTraining({ task, teacherId, submission }: TaskTrainingProps) {
  const router = useRouter()
  const [isChecked, setIsChecked] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [videos, setVideos] = useState<VideoConfig[]>([])
  const [currentVideoIndex, setCurrentVideoIndex] = useState(0)
  const [watchedVideos, setWatchedVideos] = useState<Set<number>>(new Set())
  const [videoUrl, setVideoUrl] = useState<string | null>(null)
  const [videoLoading, setVideoLoading] = useState(true)
  const [videoError, setVideoError] = useState<string | null>(null)
  const [shouldAutoplay, setShouldAutoplay] = useState(false)
  
  const content = TRAINING_CONTENT[task.index as keyof typeof TRAINING_CONTENT]
  const allWatched = watchedVideos.size === videos.length && videos.length > 0
  
  // 加载视频列表
  useEffect(() => {
    async function loadVideos() {
      console.log('开始加载培训视频列表，任务索引:', task.index)
      try {
        const result = await getTaskVideos(task.index)
        console.log('培训视频列表获取结果:', result)
        
        if (result.success && result.videos) {
          setVideos(result.videos)
        } else {
          console.error('培训视频列表获取失败:', result.error)
          setVideoError(result.error || '视频加载失败')
          setVideoLoading(false)
        }
      } catch (error) {
        console.error('加载培训视频列表失败:', error)
        setVideoError('视频加载失败: ' + (error instanceof Error ? error.message : String(error)))
        setVideoLoading(false)
      }
    }
    
    loadVideos()
  }, [task.index])
  
  // 加载当前视频 URL
  useEffect(() => {
    if (videos.length === 0) return
    
    async function loadVideoUrl() {
      console.log('开始加载培训视频 URL，索引:', currentVideoIndex)
      setVideoLoading(true)
      try {
        const result = await getVideoUrl(task.index, currentVideoIndex)
        console.log('培训视频 URL 获取结果:', result)
        
        if (result.success && result.videoUrl) {
          console.log('培训视频 URL 获取成功:', result.videoUrl)
          setVideoUrl(result.videoUrl)
          setVideoError(null)
        } else {
          console.error('培训视频 URL 获取失败:', result.error)
          setVideoError(result.error || '视频加载失败')
        }
      } catch (error) {
        console.error('加载培训视频失败:', error)
        setVideoError('视频加载失败: ' + (error instanceof Error ? error.message : String(error)))
      } finally {
        setVideoLoading(false)
      }
    }
    
    loadVideoUrl()
  }, [task.index, currentVideoIndex, videos.length])
  
  // 重置 autoplay 标志
  useEffect(() => {
    if (shouldAutoplay) {
      const timer = setTimeout(() => setShouldAutoplay(false), 1500)
      return () => clearTimeout(timer)
    }
  }, [shouldAutoplay])
  
  // 标记视频为已观看
  const markAsWatched = (index: number) => {
    setWatchedVideos(prev => new Set(prev).add(index))
  }
  
  // 监听视频播放（简单模拟，实际应监听 video 的 ended 事件）
  useEffect(() => {
    if (!videoUrl) return
    
    // 10秒后自动标记为已观看（实际应该监听视频播放进度）
    const timer = setTimeout(() => {
      markAsWatched(currentVideoIndex)
    }, 10000)
    
    return () => clearTimeout(timer)
  }, [videoUrl, currentVideoIndex])
  
  const handleSubmit = async () => {
    if (!isChecked) return
    if (!allWatched) {
      alert('请观看所有培训视频后再提交')
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
      {/* 视频播放区域 */}
      <div className="card">
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-gray-900">
            📺 {videos[currentVideoIndex]?.title || '培训视频'}
          </h2>
          {videos.length > 1 && (
            <p className="text-sm text-gray-500 mt-1">
              视频 {currentVideoIndex + 1} / {videos.length}
              {videos[currentVideoIndex]?.duration && ` · 约 ${videos[currentVideoIndex].duration} 分钟`}
            </p>
          )}
        </div>
        {videoLoading ? (
          <div className="aspect-video bg-gray-100 rounded-lg flex items-center justify-center">
            <div className="text-center text-gray-500">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-400 mx-auto mb-2"></div>
              <p>加载视频中...</p>
            </div>
          </div>
        ) : videoError ? (
          <div className="aspect-video bg-gray-100 rounded-lg flex items-center justify-center">
            <div className="text-center text-gray-500">
              <svg className="w-16 h-16 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <p className="text-red-500">{videoError}</p>
              <p className="text-sm mt-1">请检查七牛云配置或视频文件是否存在</p>
            </div>
          </div>
        ) : videoUrl ? (
          <VideoPlayer
            videoUrl={videoUrl}
            autoplay={shouldAutoplay}
            onError={(error) => setVideoError(error)}
          />
        ) : (
          <div className="aspect-video bg-gray-100 rounded-lg flex items-center justify-center">
            <div className="text-center text-gray-500">
              <svg className="w-16 h-16 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p>该任务暂无视频</p>
            </div>
          </div>
        )}
        
        {/* 已观看标记 */}
        {watchedVideos.has(currentVideoIndex) && (
          <div className="flex items-center gap-2 text-success-600 text-sm mt-4">
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            <span>已观看完成</span>
          </div>
        )}
      </div>
      
      {/* 视频列表（多视频时显示） */}
      {videos.length > 1 && (
        <div className="card">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            培训内容
          </h3>
          <div className="space-y-2">
            {videos.map((video, index) => (
              <button
                key={index}
                onClick={() => {
                  setCurrentVideoIndex(index)
                  setShouldAutoplay(true)
                }}
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
                  {video.duration && (
                    <span className="text-sm text-gray-500">{video.duration} 分钟</span>
                  )}
                </div>
              </button>
            ))}
          </div>
          
          {/* 观看进度 */}
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
      )}
      
      {/* 培训内容说明 */}
      {content && (
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            📖 {content.title}
          </h2>
          <div className="space-y-6">
            {content.sections.map((section, index) => (
              <div key={index}>
                <h3 className="font-semibold text-gray-900 mb-2">{section.title}</h3>
                <ul className="space-y-2">
                  {section.points.map((point, pointIndex) => (
                    <li key={pointIndex} className="flex items-start gap-2 text-gray-700">
                      <span className="text-primary-500 mt-1">•</span>
                      <span>{point}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {/* 确认勾选 */}
      <div className="card">
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={isChecked}
            onChange={(e) => setIsChecked(e.target.checked)}
            className="mt-1 w-5 h-5 text-primary-600 rounded focus:ring-primary-500"
          />
          <span className="text-gray-700">
            我已完整观看培训视频并理解相关内容，将在实际工作中遵守规范
          </span>
        </label>
      </div>
      
      {/* 操作按钮 */}
      <div className="flex gap-3">
        <button
          onClick={handleSubmit}
          disabled={!isChecked || isSubmitting || !allWatched}
          className="btn-primary flex-1"
        >
          {isSubmitting 
            ? '提交中...' 
            : !allWatched
              ? `请观看所有视频 (${watchedVideos.size}/${videos.length})`
              : '确认并继续'
          }
        </button>
      </div>
    </div>
  )
}

