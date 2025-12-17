'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { submitTask } from '@/app/actions/task'
import type { TaskConfig } from '@/lib/config'

interface TaskIntroProps {
  task: TaskConfig
  teacherId: string
  submission: any
}

export default function TaskIntro({ task, teacherId, submission }: TaskIntroProps) {
  const router = useRouter()
  const [isChecked, setIsChecked] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  
  const handleSubmit = async () => {
    if (!isChecked) return
    
    setIsSubmitting(true)
    
    try {
      // 提交任务（会自动推进到下一个任务）
      const result = await submitTask(teacherId, task.index, {
        taskType: task.type,
        formData: { understood: true }
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
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          📺 介绍视频
        </h2>
        <div className="aspect-video bg-gray-100 rounded-lg flex items-center justify-center">
          <div className="text-center text-gray-500">
            <svg className="w-16 h-16 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p>视频播放器</p>
            <p className="text-sm mt-1">(演示环境,实际部署时接入真实视频)</p>
          </div>
        </div>
      </div>
      
      {/* 图文说明 */}
      <div className="card">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          📖 详细说明
        </h2>
        <div className="prose prose-blue max-w-none">
          <h3>什么是伴学?</h3>
          <p>
            伴学是一种全新的数学教学模式,我们不是传统的"讲课老师",而是学生的"学习伙伴"。
            通过引导式提问、陪伴式学习,帮助学生建立数学思维。
          </p>
          
          <h3>收入结构</h3>
          <ul>
            <li>基础课时费: 80-150元/小时</li>
            <li>学生续费奖励: 额外10%-20%提成</li>
            <li>优秀老师月度奖金</li>
          </ul>
          
          <h3>时间安排</h3>
          <ul>
            <li>完全自主排课,无最低时长要求</li>
            <li>支持周末、晚上等碎片时间</li>
            <li>提前3天告知即可调整课程</li>
          </ul>
        </div>
      </div>
      
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
            我已了解伴学的工作内容、收入结构和时间安排,确认这份兼职适合我
          </span>
        </label>
      </div>
      
      {/* 操作按钮 */}
      <div className="flex gap-3">
        <button
          onClick={handleSubmit}
          disabled={!isChecked || isSubmitting}
          className="btn-primary flex-1"
        >
          {isSubmitting ? '提交中...' : '确认并继续'}
        </button>
      </div>
    </div>
  )
}

