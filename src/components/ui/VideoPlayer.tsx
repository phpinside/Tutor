'use client'

import { useEffect, useRef, useState } from 'react'
import * as PlyrModule from 'plyr'
import 'plyr/dist/plyr.css'

type PlyrInstance = {
  on: (event: string, callback: (event: any) => void) => void
  destroy: () => void
  play: () => Promise<void> | void
}

type PlyrConstructor = new (
  target: HTMLVideoElement,
  options?: Record<string, unknown>
) => PlyrInstance

const Plyr = (PlyrModule as unknown as { default?: PlyrConstructor }).default ??
  (PlyrModule as unknown as PlyrConstructor)

interface VideoPlayerProps {
  videoUrl: string
  autoplay?: boolean
  onError?: (error: string) => void
  onReady?: () => void
}

export default function VideoPlayer({ videoUrl, autoplay = false, onError, onReady }: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const playerRef = useRef<PlyrInstance | null>(null)
  const onErrorRef = useRef(onError)
  const onReadyRef = useRef(onReady)
  const [isReady, setIsReady] = useState(false)

  useEffect(() => {
    onErrorRef.current = onError
    onReadyRef.current = onReady
  }, [onError, onReady])

  useEffect(() => {
    console.log('VideoPlayer useEffect 触发, videoUrl:', videoUrl)
    if (!videoRef.current || !videoUrl) {
      console.log('videoRef 或 videoUrl 不存在')
      return
    }

    console.log('开始初始化 Plyr 播放器')
    setIsReady(false)
    const videoElement = videoRef.current
    const handleLoadedMetadata = () => {
      console.log('视频元数据加载完成')
      setIsReady(true)
    }
    
    try {
      // 初始化 Plyr 播放器
      playerRef.current = new Plyr(videoElement, {
        controls: [
          'play-large',
          'play',
          'progress',
          'current-time',
          'duration',
          'mute',
          'volume',
          'settings',
          'fullscreen'
        ],
        settings: ['speed', 'quality'],
        speed: { selected: 1, options: [0.5, 0.75, 1, 1.25, 1.5, 2] },
        i18n: {
          restart: '重新开始',
          rewind: '快退 {seektime}s',
          play: '播放',
          pause: '暂停',
          fastForward: '快进 {seektime}s',
          seek: '跳转',
          seekLabel: '{currentTime} / {duration}',
          played: '已播放',
          buffered: '已缓冲',
          currentTime: '当前时间',
          duration: '总时长',
          volume: '音量',
          mute: '静音',
          unmute: '取消静音',
          enableCaptions: '开启字幕',
          disableCaptions: '关闭字幕',
          download: '下载',
          enterFullscreen: '进入全屏',
          exitFullscreen: '退出全屏',
          frameTitle: '播放器界面',
          captions: '字幕',
          settings: '设置',
          speed: '速度',
          normal: '正常',
          quality: '画质',
        }
      })

      console.log('Plyr 实例创建成功')
      
      // 监听播放器就绪事件
      playerRef.current.on('ready', () => {
        console.log('Plyr ready 事件触发')
        setIsReady(true)
        onReadyRef.current?.()
      })

      // 监听错误事件
      playerRef.current.on('error', (event: any) => {
        console.error('视频播放错误:', event)
        onErrorRef.current?.('视频加载失败，请检查视频链接是否正确')
      })
      
      // 添加 loadedmetadata 事件监听，确保视频元数据加载后也显示播放器
      videoElement.addEventListener('loadedmetadata', handleLoadedMetadata)

    } catch (error) {
      console.error('初始化播放器失败:', error)
      onErrorRef.current?.('播放器初始化失败: ' + (error instanceof Error ? error.message : String(error)))
    }

    // 清理函数
    return () => {
      videoElement.removeEventListener('loadedmetadata', handleLoadedMetadata)
      if (playerRef.current) {
        playerRef.current.destroy()
        playerRef.current = null
      }
    }
  }, [videoUrl])

  // 处理自动播放逻辑
  useEffect(() => {
    if (autoplay && isReady && playerRef.current) {
      console.log('执行自动播放')
      // 使用 setTimeout 确保播放器完全准备好
      setTimeout(() => {
        if (playerRef.current) {
          try {
            const playPromise = playerRef.current.play()
            if (playPromise !== undefined) {
              playPromise.catch((err: any) => {
                console.error('自动播放失败:', err)
                // 某些浏览器可能会阻止自动播放，这是正常的
              })
            }
          } catch (err) {
            console.error('自动播放失败:', err)
          }
        }
      }, 300)
    }
  }, [autoplay, isReady])

  if (!videoUrl) {
    return (
      <div className="aspect-video bg-gray-100 rounded-lg flex items-center justify-center">
        <div className="text-center text-gray-500">
          <p>暂无视频</p>
        </div>
      </div>
    )
  }

  return (
    <div className="relative">
      <video
        ref={videoRef}
        className="plyr-video w-full rounded-lg"
        controls
        playsInline
      >
        <source src={videoUrl} type="video/mp4" />
        您的浏览器不支持视频播放。
      </video>
      
      {!isReady && (
        <div className="absolute inset-0 bg-gray-900 bg-opacity-50 rounded-lg flex items-center justify-center">
          <div className="text-white text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-2"></div>
            <p>加载中...</p>
          </div>
        </div>
      )}
    </div>
  )
}
