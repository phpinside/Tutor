'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface ReviewFormProps {
  submissionId: string
  teacherId: string
  taskIndex: number
  updateAction: (teacherId: string, taskIndex: number, status: string, feedback?: string) => Promise<any>
}

export default function ReviewForm({ submissionId, teacherId, taskIndex, updateAction }: ReviewFormProps) {
  const router = useRouter()
  const [feedback, setFeedback] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  
  const handleApprove = async () => {
    setIsSubmitting(true)
    try {
      const result = await updateAction(teacherId, taskIndex, 'COMPLETED', feedback || '完成得很好!')
      if (result.success) {
        router.refresh()
      } else {
        alert('操作失败,请重试')
      }
    } catch (error) {
      console.error('审核失败:', error)
      alert('操作失败,请重试')
    } finally {
      setIsSubmitting(false)
    }
  }
  
  const handleReject = async () => {
    if (!feedback.trim()) {
      alert('请填写需要调整的建议')
      return
    }
    
    setIsSubmitting(true)
    try {
      const result = await updateAction(teacherId, taskIndex, 'NEEDS_REVISION', feedback)
      if (result.success) {
        router.refresh()
      } else {
        alert('操作失败,请重试')
      }
    } catch (error) {
      console.error('审核失败:', error)
      alert('操作失败,请重试')
    } finally {
      setIsSubmitting(false)
    }
  }
  
  return (
    <div className="border-t border-gray-200 pt-6">
      <h4 className="text-sm font-semibold text-gray-700 mb-3">审核反馈:</h4>
      
      <textarea
        value={feedback}
        onChange={(e) => setFeedback(e.target.value)}
        placeholder="给老师一些具体的反馈建议(可选)"
        className="textarea mb-4"
        rows={3}
      />
      
      <div className="flex gap-3">
        <button
          onClick={handleApprove}
          disabled={isSubmitting}
          className="btn-primary flex-1"
        >
          ✓ 通过审核
        </button>
        <button
          onClick={handleReject}
          disabled={isSubmitting}
          className="btn-secondary flex-1"
        >
          ✗ 需要调整
        </button>
      </div>
    </div>
  )
}


