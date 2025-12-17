'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { submitTask } from '@/app/actions/task'
import type { TaskConfig } from '@/lib/config'

interface TaskSimulationProps {
  task: TaskConfig
  teacherId: string
  submission: any
}

// 模拟场景
const SCENARIOS = [
  {
    title: '第一次上课前的沟通',
    description: '你刚刚被分配了一个新学员小明(初二),家长在1v1群里,现在需要和家长确定首次上课时间。',
    context: '学员信息: 初二学生,数学基础中等,希望提升成绩。家长比较关心孩子的学习进度。',
    hints: [
      '自我介绍,建立信任',
      '询问学员和家长的方便时间',
      '说明首次上课的目标和内容',
      '语气友好、专业'
    ]
  }
]

export default function TaskSimulation({ task, teacherId, submission }: TaskSimulationProps) {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [messageContent, setMessageContent] = useState(submission?.textContent || '')
  
  const scenario = SCENARIOS[0] // 使用第一个场景
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!messageContent.trim()) {
      alert('请输入消息内容')
      return
    }
    
    if (messageContent.length < 50) {
      alert('消息内容太短,请完整表达')
      return
    }
    
    setIsSubmitting(true)
    
    try {
      // 提交任务（模拟类型需要审核，不会自动推进）
      const result = await submitTask(teacherId, task.index, {
        taskType: task.type,
        textContent: messageContent
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
      {/* 场景描述 */}
      <div className="card">
        <h2 className="text-lg font-semibold text-gray-900 mb-3">
          📋 场景描述
        </h2>
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg mb-4">
          <h3 className="font-semibold text-blue-900 mb-2">{scenario.title}</h3>
          <p className="text-blue-800 text-sm mb-3">{scenario.description}</p>
          <div className="text-xs text-blue-700 p-2 bg-blue-100 rounded">
            <strong>背景:</strong> {scenario.context}
          </div>
        </div>
        
        <h3 className="text-sm font-semibold text-gray-700 mb-2">💡 参考要点:</h3>
        <ul className="space-y-1.5">
          {scenario.hints.map((hint, index) => (
            <li key={index} className="flex items-start gap-2 text-sm text-gray-600">
              <span className="text-primary-500 mt-0.5">•</span>
              <span>{hint}</span>
            </li>
          ))}
        </ul>
      </div>
      
      {/* 消息编写区 */}
      <div className="card">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          ✍️ 编写你的消息
        </h2>
        
        <div className="mb-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-sm font-medium text-gray-700">发送到: </span>
            <span className="badge-primary">1v1学习群(小明)</span>
          </div>
        </div>
        
        <textarea
          value={messageContent}
          onChange={(e) => setMessageContent(e.target.value)}
          placeholder="在这里输入你要发送的消息内容..."
          className="textarea min-h-[200px]"
          required
        />
        
        <div className="flex justify-between items-center mt-2">
          <p className="text-xs text-gray-500">
            建议字数: 100-300字
          </p>
          <p className={`text-xs font-medium ${
            messageContent.length < 50 ? 'text-red-500' : 'text-gray-600'
          }`}>
            已输入: {messageContent.length} 字
          </p>
        </div>
      </div>
      
      {/* 注意事项 */}
      <div className="card bg-amber-50 border-amber-200">
        <h3 className="font-semibold text-amber-900 mb-2">⚠️ 注意事项</h3>
        <ul className="space-y-1 text-sm text-amber-800">
          <li>• 使用正式但友好的语气</li>
          <li>• 避免错别字和语病</li>
          <li>• 信息要完整、清晰</li>
          <li>• 体现专业性和责任心</li>
        </ul>
      </div>
      
      {/* 提交按钮 */}
      <div className="flex gap-3">
        <button
          type="submit"
          disabled={isSubmitting || messageContent.length < 50}
          className="btn-primary flex-1"
        >
          {isSubmitting ? '提交中...' : '提交消息'}
        </button>
      </div>
      
      <p className="text-sm text-gray-500 text-center">
        提交后我们会审核你的消息内容,并给出反馈建议
      </p>
    </form>
  )
}

