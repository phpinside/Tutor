'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { evaluateTeacher } from '@/app/actions/evaluation'

interface EvaluationContentProps {
  teacherId: string
  teacherName: string
  currentStatus: string
  mathScore: string
}

export default function EvaluationContent({ 
  teacherId, 
  teacherName,
  currentStatus,
  mathScore
}: EvaluationContentProps) {
  const router = useRouter()
  const [progress, setProgress] = useState(0)
  const [isEvaluating, setIsEvaluating] = useState(currentStatus === 'IN_PROGRESS')
  const [evaluationResult, setEvaluationResult] = useState<{
    passed: boolean
    mathScore: number
  } | null>(null)
  const [error, setError] = useState<string | null>(null)
  
  // 根据数学成绩决定评估时长（随机化）
  const [evaluationDuration] = useState(() => {
    const mathScoreNum = parseInt(mathScore, 10) || 0
    if (mathScoreNum >= 100) {
      // 成绩 >= 100: 1-10秒随机
      return Math.floor(Math.random() * 10) + 1
    } else {
      // 成绩 < 100: 60-180秒随机（1-3分钟）
      return Math.floor(Math.random() * 121) + 60
    }
  })

  // 评估进度条 - 根据成绩动态调整时长
  useEffect(() => {
    if (!isEvaluating) return

    const totalDuration = evaluationDuration // 使用动态计算的时长
    const intervalTime = 100 // 每100ms更新一次
    const increment = (100 / totalDuration) / (1000 / intervalTime) // 每次增加的百分比

    const timer = setInterval(() => {
      setProgress(prev => {
        const next = prev + increment
        if (next >= 100) {
          clearInterval(timer)
          return 100
        }
        return next
      })
    }, intervalTime)

    return () => clearInterval(timer)
  }, [isEvaluating, evaluationDuration])

  // 当进度条达到 100% 时，调用评估 API
  useEffect(() => {
    if (progress >= 100 && isEvaluating) {
      performEvaluation()
    }
  }, [progress, isEvaluating])

  const performEvaluation = async () => {
    try {
      const result = await evaluateTeacher(teacherId)
      
      if (result.success && result.passed !== undefined) {
        setEvaluationResult({
          passed: result.passed,
          mathScore: result.mathScore || 0
        })
        setIsEvaluating(false)
        
        // 使用 localStorage 存储评估状态
        const evaluationKey = `teacher_evaluation_${teacherId}`
        
        if (result.passed) {
          // 通过评估：清除 localStorage 标记（如果有）
          localStorage.removeItem(evaluationKey)
          // 3秒后跳转到完成页面
          setTimeout(() => {
            router.push('/onboarding/complete')
            router.refresh()
          }, 3000)
        } else {
          // 未通过评估：存储到 localStorage
          localStorage.setItem(evaluationKey, JSON.stringify({
            rejected: true,
            mathScore: result.mathScore || 0,
            evaluatedAt: new Date().toISOString()
          }))
        }
      } else {
        setError(result.error || '评估失败')
        setIsEvaluating(false)
      }
    } catch (err) {
      setError('评估过程出现错误，请刷新页面重试')
      setIsEvaluating(false)
    }
  }

  // 检查 localStorage 中的评估状态
  useEffect(() => {
    const evaluationKey = `teacher_evaluation_${teacherId}`
    const storedEvaluation = localStorage.getItem(evaluationKey)
    
    if (currentStatus === 'COMPLETED') {
      // 已完成：显示成功并跳转
      setEvaluationResult({
        passed: true,
        mathScore: parseInt(mathScore, 10) || 0
      })
      setIsEvaluating(false)
      // 清除可能存在的 rejected 标记
      localStorage.removeItem(evaluationKey)
      // 跳转到完成页面
      setTimeout(() => {
        router.push('/onboarding/complete')
        router.refresh()
      }, 2000)
    } else if (storedEvaluation) {
      // 有 localStorage 标记：说明之前评估未通过
      try {
        const evaluation = JSON.parse(storedEvaluation)
        if (evaluation.rejected) {
          setEvaluationResult({
            passed: false,
            mathScore: evaluation.mathScore || 0
          })
          setIsEvaluating(false)
        }
      } catch (err) {
        console.error('解析评估状态失败:', err)
      }
    }
  }, [currentStatus, mathScore, router, teacherId])

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center p-4">
      <div className="max-w-2xl w-full">
        <div className="bg-white rounded-2xl shadow-xl p-8 md:p-12">
          {/* 评估中 */}
          {isEvaluating && (
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-20 h-20 bg-blue-100 rounded-full mb-6">
                <svg 
                  className="w-10 h-10 text-blue-600 animate-spin" 
                  fill="none" 
                  viewBox="0 0 24 24"
                >
                  <circle 
                    className="opacity-25" 
                    cx="12" 
                    cy="12" 
                    r="10" 
                    stroke="currentColor" 
                    strokeWidth="4"
                  />
                  <path 
                    className="opacity-75" 
                    fill="currentColor" 
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
              </div>
              
              <h1 className="text-3xl font-bold text-gray-900 mb-4">
                系统评估中
              </h1>
              
              <p className="text-gray-600 mb-8">
                正在对您的申请进行综合评估，请稍候...
              </p>
              
              {/* 进度条 */}
              <div className="mb-6">
                <div className="bg-gray-200 rounded-full h-3 overflow-hidden">
                  <div 
                    className="bg-gradient-to-r from-blue-500 to-purple-500 h-full transition-all duration-300 ease-out"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <p className="text-sm text-gray-500 mt-2">
                  评估进度: {Math.floor(progress)}%
                </p>
              </div>
              
            
            </div>
          )}

          {/* 评估结果 - 通过 */}
          {!isEvaluating && evaluationResult && evaluationResult.passed && (
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-20 h-20 bg-green-100 rounded-full mb-6">
                <svg 
                  className="w-10 h-10 text-green-600" 
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                >
                  <path 
                    strokeLinecap="round" 
                    strokeLinejoin="round" 
                    strokeWidth={2} 
                    d="M5 13l4 4L19 7" 
                  />
                </svg>
              </div>
              
              <h1 className="text-3xl font-bold text-gray-900 mb-4">
                🎉 恭喜，{teacherName}！
              </h1>
              
              <p className="text-gray-600 mb-6">
                您已成功通过系统评估
              </p>
              
             
              
              <p className="text-sm text-gray-500">
                正在跳转到完成页面...
              </p>
            </div>
          )}

          {/* 评估结果 - 未通过 */}
          {!isEvaluating && evaluationResult && !evaluationResult.passed && (
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-20 h-20 bg-orange-100 rounded-full mb-6">
                <svg 
                  className="w-10 h-10 text-orange-600" 
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                >
                  <path 
                    strokeLinecap="round" 
                    strokeLinejoin="round" 
                    strokeWidth={2} 
                    d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" 
                  />
                </svg>
              </div>
              
              <h1 className="text-2xl font-bold text-gray-900 mb-6">
                感谢你的提交
              </h1>
              
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-6 mb-6 text-left">
                <p className="text-gray-700 leading-relaxed mb-4">
                  本次申请未能通过当前阶段的系统评估，暂无法继续。
                </p>
                <p className="text-gray-700 leading-relaxed">
                  你的信息已保存，后续如有更合适的任务或机会，我们会第一时间通知你。
                </p>
              </div>
              
          
              
              <p className="text-sm text-gray-500">
                如有疑问，请联系您的推荐人。
              </p>
            </div>
          )}

          {/* 错误信息 */}
          {error && (
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-20 h-20 bg-red-100 rounded-full mb-6">
                <svg 
                  className="w-10 h-10 text-red-600" 
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                >
                  <path 
                    strokeLinecap="round" 
                    strokeLinejoin="round" 
                    strokeWidth={2} 
                    d="M6 18L18 6M6 6l12 12" 
                  />
                </svg>
              </div>
              
              <h1 className="text-2xl font-bold text-gray-900 mb-4">
                评估出现错误
              </h1>
              
              <p className="text-gray-600 mb-6">
                {error}
              </p>
              
              <button
                onClick={() => router.refresh()}
                className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                刷新页面
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
