import React from 'react'
import Link from 'next/link'
import { formatDuration } from '@/lib/utils'
import type { TaskConfig } from '@/lib/config'

interface TaskCardProps {
  task: TaskConfig
  status?: string
  feedback?: string | null
  isCurrentTask?: boolean
}

export default function TaskCard({ task, status = 'NOT_STARTED', feedback, isCurrentTask }: TaskCardProps) {
  const isCompleted = status === 'COMPLETED'
  const needsRevision = status === 'NEEDS_REVISION'
  const isPending = status === 'PENDING_FEEDBACK'
  
  return (
    <div className={`card-hover ${isCurrentTask ? 'ring-2 ring-primary-500' : ''}`}>
      {/* 任务头部 */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <span className="text-4xl">{task.emoji}</span>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">
              {task.title}
            </h3>
            <p className="text-sm text-gray-500 mt-0.5">
              {formatDuration(task.estimatedMinutes)}
            </p>
          </div>
        </div>
        
        {/* 状态标签 */}
        {isCompleted && (
          <span className="badge-success">✓ 已完成</span>
        )}
        {needsRevision && (
          <span className="badge-warning">需调整</span>
        )}
        {isPending && (
          <span className="badge-warning">待反馈</span>
        )}
        {task.isOptional && !isCompleted && (
          <span className="badge-gray">可选</span>
        )}
      </div>
      
      {/* 任务说明 */}
      <p className="text-gray-600 mb-4">
        {task.description}
      </p>
      
      {/* 任务要求 */}
      <div className="mb-4">
        <p className="text-sm font-medium text-gray-700 mb-2">任务内容:</p>
        <ul className="space-y-1.5">
          {task.requirements.map((req, index) => (
            <li key={index} className="text-sm text-gray-600 flex items-start gap-2">
              <span className="text-primary-500 mt-0.5">•</span>
              <span>{req}</span>
            </li>
          ))}
        </ul>
      </div>
      
      {/* 反馈信息 */}
      {feedback && (
        <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
          <p className="text-sm font-medium text-amber-900 mb-1">💡 反馈建议</p>
          <p className="text-sm text-amber-800">{feedback}</p>
        </div>
      )}
      
      {/* 行动按钮 */}
      <div className="flex gap-3">
        {isCompleted ? (
          <Link 
            href={`/onboarding/task/${task.index}`}
            className="btn-outline w-full"
          >
            查看详情
          </Link>
        ) : (
          <Link 
            href={`/onboarding/task/${task.index}`}
            className="btn-primary w-full"
          >
            {needsRevision ? '重新完成' : isPending ? '查看进度' : '开始任务'}
          </Link>
        )}
      </div>
    </div>
  )
}


