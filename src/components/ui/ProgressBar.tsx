import React from 'react'

interface ProgressBarProps {
  current: number
  total: number
  showLabel?: boolean
}

export default function ProgressBar({ current, total, showLabel = true }: ProgressBarProps) {
  const percentage = Math.round((current / total) * 100)
  
  return (
    <div className="w-full">
      <div className="progress-bar-container relative">
        <div className="progress-bar">
          <div 
            className="progress-fill"
            style={{ width: `${percentage}%` }}
          />
        </div>
        {/* 百分比显示在进度条上 */}
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-xs font-bold text-gray-700 drop-shadow-sm">
            {percentage}%
          </span>
        </div>
      </div>
    </div>
  )
}

