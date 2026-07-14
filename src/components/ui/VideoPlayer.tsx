'use client'

import { useEffect, useRef, useState } from 'react'

interface VideoPlayerProps {
  videoUrl: string
  videoKey: string
  autoplay?: boolean
  onAutoplaySettled?: () => void
  onError?: (error: string) => void
  onReady?: () => void
  onEnded?: (videoKey: string) => void
}

export default function VideoPlayer({
  videoUrl,
  videoKey,
  autoplay = false,
  onAutoplaySettled,
  onError,
  onReady,
  onEnded
}: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [isReady, setIsReady] = useState(false)

  useEffect(() => {
    setIsReady(false)
  }, [videoKey, videoUrl])

  useEffect(() => {
    if (!autoplay || !isReady || !videoRef.current) return

    let cancelled = false

    const play = async () => {
      const video = videoRef.current
      if (!video) return

      try {
        await video.play()
      } catch (error) {
        if (cancelled || video.muted) {
          if (!cancelled) {
            console.error('自动播放失败:', error)
          }
          return
        }

        // Browsers may block asynchronous autoplay with sound. Retry muted so
        // the next training video still starts without requiring another click.
        video.muted = true

        try {
          await video.play()
        } catch (retryError) {
          if (!cancelled) {
            console.error('自动播放失败:', retryError)
          }
        }
      } finally {
        if (!cancelled) {
          onAutoplaySettled?.()
        }
      }
    }

    void play()

    return () => {
      cancelled = true
    }
  }, [autoplay, isReady, onAutoplaySettled, videoKey])

  const handleEnded = () => {
    // The native ended event is emitted only when this media element reaches
    // its end, unlike player-library lifecycle events during video switching.
    onEnded?.(videoKey)
  }

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
        key={videoKey}
        ref={videoRef}
        className="w-full rounded-lg"
        controls
        playsInline
        onLoadedMetadata={() => {
          setIsReady(true)
          onReady?.()
        }}
        onEnded={handleEnded}
        onError={() => onError?.('视频加载失败，请检查视频链接是否正确')}
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
