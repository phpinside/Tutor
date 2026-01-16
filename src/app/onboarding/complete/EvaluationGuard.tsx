'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

interface EvaluationGuardProps {
  teacherId: string
}

/**
 * 评估守卫组件
 * 检查 localStorage 中是否有评估未通过的标记
 * 如果有，则重定向到评估页面
 */
export default function EvaluationGuard({ teacherId }: EvaluationGuardProps) {
  const router = useRouter()

  useEffect(() => {
    const evaluationKey = `teacher_evaluation_${teacherId}`
    const storedEvaluation = localStorage.getItem(evaluationKey)

    if (storedEvaluation) {
      try {
        const evaluation = JSON.parse(storedEvaluation)
        // 如果有 rejected 标记，重定向到评估页面
        if (evaluation.rejected) {
          router.push('/onboarding/evaluation')
        }
      } catch (err) {
        console.error('解析评估状态失败:', err)
      }
    }
  }, [teacherId, router])

  // 这个组件不渲染任何内容
  return null
}
