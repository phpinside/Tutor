'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { submitTask } from '@/app/actions/task'
import type { TaskConfig, TestQuestion } from '@/lib/config'

interface TaskOnlineTestProps {
  task: TaskConfig
  teacherId: string
  submission?: any
}

const OPTION_LABELS = ['A', 'B', 'C', 'D']

const renderTextWithLinks = (text: string) => {
  const urlRegex = /(https?:\/\/[^\s]+)/g
  const parts = text.split(urlRegex)

  return parts.map((part, index) => {
    if (part.match(urlRegex)) {
      return (
        <a
          key={index}
          href={part}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary-600 hover:text-primary-700 underline break-all"
        >
          {part}
        </a>
      )
    }

    return <span key={index}>{part}</span>
  })
}

export default function TaskOnlineTest({ task, teacherId, submission }: TaskOnlineTestProps) {
  const router = useRouter()
  const questions: TestQuestion[] = task.questions || []
  const questionRefs = useRef<Record<string, HTMLDivElement | null>>({})

  const [answers, setAnswers] = useState<Record<string, string[]>>(() => {
    if (submission?.formData?.answers) {
      return submission.formData.answers as Record<string, string[]>
    }
    return {}
  })

  const [submitted, setSubmitted] = useState(false)
  const [score, setScore] = useState(0)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [highlightedQuestionId, setHighlightedQuestionId] = useState<string | null>(null)

  const toggleAnswer = (questionId: string, label: string, type: 'SINGLE' | 'MULTIPLE') => {
    if (submitted) return
    if (highlightedQuestionId === questionId) {
      setHighlightedQuestionId(null)
    }
    setAnswers(prev => {
      const current = prev[questionId] || []
      if (type === 'SINGLE') {
        return { ...prev, [questionId]: [label] }
      } else {
        const next = current.includes(label)
          ? current.filter(a => a !== label)
          : [...current, label].sort()
        return { ...prev, [questionId]: next }
      }
    })
  }

  const isCorrect = (q: TestQuestion): boolean => {
    const given = (answers[q.id] || []).sort().join(',')
    const correct = [...q.answer].sort().join(',')
    return given === correct
  }

  const calculateScore = (): number => {
    return questions.reduce((sum, q) => sum + (isCorrect(q) ? 5 : 0), 0)
  }

  const handleSubmit = async () => {
    const unanswered = questions.filter(q => !(answers[q.id]?.length))
    if (unanswered.length > 0) {
      const firstUnanswered = unanswered[0]
      setHighlightedQuestionId(firstUnanswered.id)
      alert(`还有 ${unanswered.length} 道题未作答，请完成所有题目后提交`)
      requestAnimationFrame(() => {
        const target = questionRefs.current[firstUnanswered.id]
        if (!target) return
        target.scrollIntoView({ behavior: 'smooth', block: 'center' })
        target.focus()
      })
      return
    }

    setHighlightedQuestionId(null)
    const finalScore = calculateScore()
    setScore(finalScore)
    setSubmitted(true)

    if (finalScore > 90) {
      setIsSubmitting(true)
      try {
        await submitTask(teacherId, task.index, {
          taskType: 'ONLINE_TEST',
          formData: { score: finalScore, answers }
        })
        router.push('/onboarding')
        router.refresh()
      } catch (err) {
        console.error('提交任务失败:', err)
        alert('提交失败，请重试')
      } finally {
        setIsSubmitting(false)
      }
    }
  }

  const handleRetry = () => {
    setAnswers({})
    setSubmitted(false)
    setScore(0)
    setHighlightedQuestionId(null)
  }

  if (questions.length === 0) {
    return (
      <div className="max-w-2xl mx-auto py-12 text-center text-gray-500">
        <p className="text-4xl mb-4">📝</p>
        <p className="text-lg font-medium">题目尚未配置</p>
        <p className="text-sm mt-2">管理员还未添加测试题目，请稍后再试</p>
      </div>
    )
  }

  const totalScore = questions.length * 5
  const passed = submitted && score > 90
  const answeredCount = questions.filter(q => answers[q.id]?.length).length

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* 测试说明 */}
      <div className="card">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">测试说明</h2>
            <p className="text-sm text-gray-500 mt-1">
              请完成全部题目后再提交，系统会立即判分。
            </p>
          </div>
          <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-orange-50 text-orange-700 border border-orange-200 shrink-0">
            90分以上通过
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
          <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-3">
            <p className="text-xs text-gray-500">题目数量</p>
            <p className="text-lg font-semibold text-gray-900 mt-1">{questions.length} 题</p>
          </div>
          <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-3">
            <p className="text-xs text-gray-500">每题分值</p>
            <p className="text-lg font-semibold text-gray-900 mt-1">5 分</p>
          </div>
          <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-3">
            <p className="text-xs text-gray-500">满分</p>
            <p className="text-lg font-semibold text-gray-900 mt-1">{totalScore} 分</p>
          </div>
          <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-3">
            <p className="text-xs text-gray-500">当前进度</p>
            <p className="text-lg font-semibold text-gray-900 mt-1">{answeredCount}/{questions.length}</p>
          </div>
        </div>

        {task.requirements.length > 0 && (
          <div className="mt-4 pt-4 border-t border-gray-200">
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
              <p className="text-sm font-semibold text-amber-900 mb-2">作答提示</p>
              <ul className="space-y-1.5">
              {task.requirements.map((requirement, index) => (
                <li key={index} className="flex items-start gap-2 text-sm text-amber-800">
                  <span className="text-amber-500 mt-0.5">•</span>
                  <span className="break-words">{renderTextWithLinks(requirement)}</span>
                </li>
              ))}
              </ul>
            </div>
          </div>
        )}
      </div>

      {/* 题目列表 */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">答题区</h2>
          <span className="text-sm text-gray-500">
            已作答 {answeredCount} / {questions.length}
          </span>
        </div>

        {questions.map((q, idx) => {
          const selectedAnswers = answers[q.id] || []
          const correct = submitted ? isCorrect(q) : null

          return (
            <div
              key={q.id}
              ref={node => {
                questionRefs.current[q.id] = node
              }}
              tabIndex={-1}
              className={`card border-2 transition-all duration-200 outline-none ${
                highlightedQuestionId === q.id
                  ? 'border-orange-400 bg-orange-50 ring-2 ring-orange-200'
                  : submitted
                    ? correct
                      ? 'border-green-300 bg-green-50'
                      : 'border-red-300 bg-red-50'
                    : 'border-gray-200'
              }`}
            >
              <div className="flex items-start gap-2 mb-3">
                <span className="text-sm font-semibold text-gray-500 shrink-0 mt-0.5">
                  {idx + 1}.
                </span>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                      q.type === 'SINGLE' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'
                    }`}>
                      {q.type === 'SINGLE' ? '单选' : '多选'}
                    </span>
                    <span className="text-xs text-gray-400">5分</span>
                    {submitted && (
                      <span className={`text-xs font-medium ${correct ? 'text-green-600' : 'text-red-600'}`}>
                        {correct ? '✓ 正确' : '✗ 错误'}
                      </span>
                    )}
                  </div>
                  <p className="text-gray-900 font-medium">{q.question}</p>
                </div>
              </div>

              <div className="space-y-2 pl-5">
                {OPTION_LABELS.map((label, i) => {
                  const isSelected = selectedAnswers.includes(label)
                  const isCorrectOption = q.answer.includes(label)

                  let optionClass = 'border-gray-200 bg-white hover:border-primary-300 hover:bg-primary-50'
                  if (submitted) {
                    if (isCorrectOption) {
                      optionClass = 'border-green-400 bg-green-100'
                    } else if (isSelected && !isCorrectOption) {
                      optionClass = 'border-red-400 bg-red-100'
                    } else {
                      optionClass = 'border-gray-200 bg-white'
                    }
                  } else if (isSelected) {
                    optionClass = 'border-primary-400 bg-primary-50'
                  }

                  return (
                    <label
                      key={label}
                      className={`flex items-center gap-3 p-2.5 rounded-lg border-2 cursor-pointer transition-colors ${optionClass} ${submitted ? 'cursor-default' : ''}`}
                    >
                      {q.type === 'SINGLE' ? (
                        <input
                          type="radio"
                          name={`q-${q.id}`}
                          checked={isSelected}
                          onChange={() => toggleAnswer(q.id, label, 'SINGLE')}
                          disabled={submitted}
                          className="accent-primary-600"
                        />
                      ) : (
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleAnswer(q.id, label, 'MULTIPLE')}
                          disabled={submitted}
                          className="accent-primary-600"
                        />
                      )}
                      <span className="text-sm font-medium text-gray-600 shrink-0">{label}.</span>
                      <span className="text-sm text-gray-800">{q.options[i]}</span>
                      {submitted && isCorrectOption && (
                        <span className="ml-auto text-xs text-green-600 font-medium shrink-0">正确答案</span>
                      )}
                    </label>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>

      {/* 测试结果横幅 */}
      {submitted && (
        <div className={`rounded-xl p-4 border-2 ${passed
          ? 'bg-green-50 border-green-300 text-green-800'
          : 'bg-red-50 border-red-300 text-red-800'
        }`}>
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide opacity-80">本次结果</p>
              <p className="font-bold text-lg">
                {passed ? '🎉 测试通过！' : '❌ 测试不通过，请重新测试'}
              </p>
              <p className="text-sm mt-1">
                得分：<span className="font-bold text-2xl">{score}</span> / {totalScore} 分
                &nbsp;·&nbsp;
                答对 {questions.filter(q => isCorrect(q)).length} / {questions.length} 题
              </p>
            </div>
            {passed && isSubmitting && (
              <span className="text-sm text-green-700 shrink-0">正在跳转...</span>
            )}
          </div>
        </div>
      )}

      {/* 提交按钮 */}
      {!submitted && (
            <button
              type="button"
              onClick={handleSubmit}
              className="btn-primary w-full py-3 text-base"
            >
              提交测试
            </button>
      )}

      {/* 底部重试 */}
      {submitted && !passed && (
        <div className="card">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-gray-800">可以重新作答并再次提交</p>
              <p className="text-xs text-gray-500 mt-1">
                重试会清空本次选择结果
              </p>
            </div>
            <button
              type="button"
              onClick={handleRetry}
              className="btn-primary px-8 py-3 text-base shrink-0"
            >
              重新测试
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
