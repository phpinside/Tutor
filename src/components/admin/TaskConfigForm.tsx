'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createTaskConfig, updateTaskConfig, deleteTaskConfig } from '@/app/actions/config'
import type { TestQuestion } from '@/lib/config'

interface TaskConfigFormProps {
  task?: any
}

const TASK_TYPES = [
  { value: 'INFO', label: '了解信息' },
  { value: 'FORM', label: '填写表单' },
  { value: 'VIDEO_UPLOAD', label: '视频上传' },
  { value: 'TRAINING', label: '观看培训' },
  { value: 'ONLINE_TEST', label: '在线测试' }
]

const OPTION_LABELS = ['A', 'B', 'C', 'D']

function generateId() {
  return Math.random().toString(36).slice(2, 10)
}

function normalizeQuestion(input: any, usedIds?: Set<string>): TestQuestion {
  const rawId = typeof input?.id === 'string' ? input.id.trim() : ''
  const id = rawId && !usedIds?.has(rawId) ? rawId : generateId()
  usedIds?.add(id)

  return {
    id,
    type: input?.type === 'MULTIPLE' ? 'MULTIPLE' : 'SINGLE',
    question: String(input?.question || ''),
    options: OPTION_LABELS.map((_, idx) => String(input?.options?.[idx] || '')),
    answer: Array.isArray(input?.answer)
      ? input.answer
          .map(String)
          .filter((label: string) => OPTION_LABELS.includes(label))
      : []
  }
}

function normalizeQuestions(input: any): TestQuestion[] {
  if (!Array.isArray(input)) return []
  const usedIds = new Set<string>()
  return input.map(question => normalizeQuestion(question, usedIds))
}

function cloneQuestion(question: TestQuestion): TestQuestion {
  return {
    ...question,
    options: [...question.options],
    answer: [...question.answer]
  }
}

const emptyQuestion = (): TestQuestion => ({
  id: generateId(),
  type: 'SINGLE',
  question: '',
  options: ['', '', '', ''],
  answer: []
})

interface QuestionEditorProps {
  question: TestQuestion
  onSave: (q: TestQuestion) => void
  onCancel: () => void
}

function QuestionEditor({ question, onSave, onCancel }: QuestionEditorProps) {
  const [draft, setDraft] = useState<TestQuestion>(() => cloneQuestion(question))

  useEffect(() => {
    setDraft(cloneQuestion(question))
  }, [question])

  const toggleAnswer = (label: string) => {
    if (draft.type === 'SINGLE') {
      setDraft(prev => ({ ...prev, answer: [label] }))
    } else {
      setDraft(prev => {
        const next = prev.answer.includes(label)
          ? prev.answer.filter(a => a !== label)
          : [...prev.answer, label].sort()
        return { ...prev, answer: next }
      })
    }
  }

  const handleTypeChange = (type: 'SINGLE' | 'MULTIPLE') => {
    setDraft(prev => ({ ...prev, type, answer: [] }))
  }

  const handleOptionChange = (idx: number, value: string) => {
    const opts = [...draft.options]
    opts[idx] = value
    setDraft(prev => ({ ...prev, options: opts }))
  }

  const handleSave = () => {
    if (!draft.question.trim()) { alert('请输入题目内容'); return }
    if (draft.options.some(o => !o.trim())) { alert('请填写所有选项'); return }
    if (draft.answer.length === 0) { alert('请选择正确答案'); return }
    onSave(cloneQuestion(draft))
  }

  return (
    <div className="border border-blue-200 rounded-lg p-4 bg-blue-50 space-y-3">
      {/* 题型 */}
      <div className="flex items-center gap-4">
        <span className="text-sm font-medium text-gray-700">题型：</span>
        {(['SINGLE', 'MULTIPLE'] as const).map(t => (
          <label key={t} className="flex items-center gap-1 cursor-pointer text-sm">
            <input
              type="radio"
              checked={draft.type === t}
              onChange={() => handleTypeChange(t)}
            />
            {t === 'SINGLE' ? '单选' : '多选'}
          </label>
        ))}
      </div>

      {/* 题目 */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">题目内容</label>
        <textarea
          value={draft.question}
          onChange={e => setDraft(prev => ({ ...prev, question: e.target.value }))}
          className="textarea"
          rows={2}
          placeholder="输入题目..."
        />
      </div>

      {/* 选项 */}
      <div className="space-y-2">
        <p className="text-sm font-medium text-gray-700">
          选项（点击右侧{draft.type === 'SINGLE' ? '单选按钮' : '复选框'}标记正确答案）
        </p>
        {OPTION_LABELS.map((label, idx) => (
          <div key={label} className="flex items-center gap-2">
            <span className="text-sm font-bold text-gray-500 w-4">{label}.</span>
            <input
              type="text"
              value={draft.options[idx]}
              onChange={e => handleOptionChange(idx, e.target.value)}
              className="input flex-1"
              placeholder={`选项 ${label}`}
            />
            {draft.type === 'SINGLE' ? (
              <input
                type="radio"
                checked={draft.answer.includes(label)}
                onChange={() => toggleAnswer(label)}
                className="w-4 h-4 accent-green-600"
                title="设为正确答案"
              />
            ) : (
              <input
                type="checkbox"
                checked={draft.answer.includes(label)}
                onChange={() => toggleAnswer(label)}
                className="w-4 h-4 accent-green-600"
                title="设为正确答案"
              />
            )}
          </div>
        ))}
        {draft.answer.length > 0 && (
          <p className="text-xs text-green-700">正确答案：{draft.answer.join('、')}</p>
        )}
      </div>

      <div className="flex gap-2 pt-1">
        <button type="button" onClick={handleSave} className="btn-primary text-sm px-3 py-1.5">保存题目</button>
        <button type="button" onClick={onCancel} className="btn-secondary text-sm px-3 py-1.5">取消</button>
      </div>
    </div>
  )
}

export default function TaskConfigForm({ task }: TaskConfigFormProps) {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const importRef = useRef<HTMLInputElement>(null)

  const [formData, setFormData] = useState({
    index: task?.index ?? 0,
    title: task?.title || '',
    phase: task?.phase ?? 1,
    emoji: task?.emoji || '📚',
    type: task?.type || 'INFO',
    description: task?.description || '',
    estimatedMinutes: task?.estimatedMinutes ?? 5,
    isOptional: task?.isOptional || false,
    requirements: task?.requirements ? (task.requirements as string[]).join('\n') : '',
    isActive: task?.isActive !== false,
    sortOrder: task?.sortOrder ?? 0
  })

  const [questions, setQuestions] = useState<TestQuestion[]>(() => normalizeQuestions(task?.questions))
  const [editingId, setEditingId] = useState<string | null>(null)
  const [showAddForm, setShowAddForm] = useState(false)

  const handleChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  // ---------- question management ----------
  const handleAddQuestion = (q: TestQuestion) => {
    setQuestions(prev => [...prev, normalizeQuestion(q)])
    setShowAddForm(false)
  }

  const handleEditQuestion = (q: TestQuestion) => {
    setQuestions(prev => prev.map(item => item.id === q.id ? normalizeQuestion(q) : item))
    setEditingId(null)
  }

  const handleDeleteQuestion = (id: string) => {
    if (!confirm('确定删除这道题？')) return
    setQuestions(prev => prev.filter(q => q.id !== id))
  }

  const handleExportJSON = () => {
    const blob = new Blob([JSON.stringify(questions, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `task-${formData.index}-questions.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleImportJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => {
      try {
        const data = JSON.parse(ev.target?.result as string)
        if (!Array.isArray(data)) { alert('JSON 格式错误：应为数组'); return }
        const normalized = normalizeQuestions(data)
        setQuestions(normalized)
        alert(`成功导入 ${normalized.length} 道题目`)
      } catch {
        alert('JSON 解析失败，请检查文件格式')
      }
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  // ---------- submit ----------
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.title || !formData.description) {
      alert('请填写必填字段')
      return
    }

    setIsSubmitting(true)

    try {
      const requirements = formData.requirements
        .split('\n')
        .map(r => r.trim())
        .filter(r => r)

      const data = {
        ...formData,
        requirements,
        questions: formData.type === 'ONLINE_TEST' ? questions : undefined
      }

      let result
      if (task) {
        result = await updateTaskConfig(task.id, data)
      } else {
        result = await createTaskConfig(data)
      }

      if (result.success) {
        router.push('/admin/config')
        router.refresh()
      } else {
        alert(result.error || '操作失败')
      }
    } catch (error) {
      console.error('提交失败:', error)
      alert('操作失败,请重试')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = async () => {
    if (!task) return

    if (!confirm('确定要删除这个任务吗？此操作不可恢复。')) {
      return
    }

    setIsDeleting(true)

    try {
      const result = await deleteTaskConfig(task.id)

      if (result.success) {
        router.push('/admin/config')
        router.refresh()
      } else {
        alert(result.error || '删除失败')
      }
    } catch (error) {
      console.error('删除失败:', error)
      alert('删除失败,请重试')
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-3xl">
      <div className="card mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">基本信息</h2>

        <div className="grid grid-cols-2 gap-4">
          {/* 任务索引 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              任务索引 <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              value={formData.index}
              onChange={(e) => {
                const val = parseInt(e.target.value)
                handleChange('index', isNaN(val) ? 0 : val)
              }}
              className="input"
              required
              min="0"
            />
            <p className="text-xs text-gray-500 mt-1">从0开始的整数,决定任务顺序</p>
          </div>

          {/* 阶段 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              所属阶段 <span className="text-red-500">*</span>
            </label>
            <select
              value={formData.phase}
              onChange={(e) => {
                const val = parseInt(e.target.value)
                handleChange('phase', isNaN(val) ? 1 : val)
              }}
              className="input"
              required
            >
              <option value="1">阶段 1</option>
              <option value="2">阶段 2</option>
              <option value="3">阶段 3</option>
            </select>
          </div>

          {/* Emoji */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Emoji 图标 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.emoji}
              onChange={(e) => handleChange('emoji', e.target.value)}
              className="input"
              required
              placeholder="如: 📚"
            />
          </div>

          {/* 任务类型 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              任务类型 <span className="text-red-500">*</span>
            </label>
            <select
              value={formData.type}
              onChange={(e) => handleChange('type', e.target.value)}
              className="input"
              required
            >
              {TASK_TYPES.map(type => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
          </div>

          {/* 预计时长 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              预计时长(分钟) <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              value={formData.estimatedMinutes}
              onChange={(e) => {
                const val = parseInt(e.target.value)
                handleChange('estimatedMinutes', isNaN(val) ? 5 : val)
              }}
              className="input"
              required
              min="1"
            />
          </div>

          {/* 排序 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">排序权重</label>
            <input
              type="number"
              value={formData.sortOrder}
              onChange={(e) => {
                const val = parseInt(e.target.value)
                handleChange('sortOrder', isNaN(val) ? 0 : val)
              }}
              className="input"
              min="0"
            />
            <p className="text-xs text-gray-500 mt-1">数字越小越靠前</p>
          </div>
        </div>

        {/* 任务标题 */}
        <div className="mt-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            任务标题 <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={formData.title}
            onChange={(e) => handleChange('title', e.target.value)}
            className="input"
            required
            placeholder="如: 了解伴学兼职"
          />
        </div>

        {/* 任务描述 */}
        <div className="mt-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            任务描述 <span className="text-red-500">*</span>
          </label>
          <textarea
            value={formData.description}
            onChange={(e) => handleChange('description', e.target.value)}
            className="textarea"
            required
            rows={3}
            placeholder="描述任务的目的和内容..."
          />
        </div>

        {/* 任务要求 */}
        <div className="mt-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            任务要求(每行一条)
          </label>
          <textarea
            value={formData.requirements}
            onChange={(e) => handleChange('requirements', e.target.value)}
            className="textarea"
            rows={5}
            placeholder="观看视频&#10;阅读图文&#10;勾选我已了解"
          />
          <p className="text-xs text-gray-500 mt-1">每行输入一条要求,系统会自动解析为列表</p>
        </div>

        {/* 开关选项 */}
        <div className="mt-4 space-y-3">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={formData.isOptional}
              onChange={(e) => handleChange('isOptional', e.target.checked)}
              className="w-4 h-4 text-primary-600 rounded focus:ring-primary-500"
            />
            <span className="text-sm text-gray-700">标记为可选任务</span>
          </label>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={formData.isActive}
              onChange={(e) => handleChange('isActive', e.target.checked)}
              className="w-4 h-4 text-primary-600 rounded focus:ring-primary-500"
            />
            <span className="text-sm text-gray-700">启用此任务</span>
          </label>
        </div>
      </div>

      {/* 在线测试题目管理 */}
      {formData.type === 'ONLINE_TEST' && (
        <div className="card mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">题目管理</h2>
              <p className="text-sm text-gray-500 mt-0.5">
                共 {questions.length} 题 · 满分 {questions.length * 5} 分 · 90分以上通过
              </p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => importRef.current?.click()}
                className="btn-secondary text-sm"
              >
                导入 JSON
              </button>
              <input
                ref={importRef}
                type="file"
                accept=".json,application/json"
                className="hidden"
                onChange={handleImportJSON}
              />
              {questions.length > 0 && (
                <button
                  type="button"
                  onClick={handleExportJSON}
                  className="btn-secondary text-sm"
                >
                  导出 JSON
                </button>
              )}
              <button
                type="button"
                onClick={() => { setShowAddForm(true); setEditingId(null) }}
                className="btn-primary text-sm"
                disabled={showAddForm}
              >
                + 添加题目
              </button>
            </div>
          </div>

          {/* 新增表单 */}
          {showAddForm && (
            <div className="mb-4">
              <QuestionEditor
                question={emptyQuestion()}
                onSave={handleAddQuestion}
                onCancel={() => setShowAddForm(false)}
              />
            </div>
          )}

          {/* 题目列表 */}
          {questions.length === 0 && !showAddForm ? (
            <p className="text-sm text-gray-400 text-center py-8">暂无题目，点击「+ 添加题目」或「导入 JSON」开始</p>
          ) : (
            <div className="space-y-3">
              {questions.map((q, idx) => (
                <div key={q.id}>
                  {editingId === q.id ? (
                    <QuestionEditor
                      question={q}
                      onSave={handleEditQuestion}
                      onCancel={() => setEditingId(null)}
                    />
                  ) : (
                    <div className="border border-gray-200 rounded-lg p-3 bg-white">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs font-medium text-gray-400">Q{idx + 1}</span>
                            <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${q.type === 'SINGLE' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>
                              {q.type === 'SINGLE' ? '单选' : '多选'}
                            </span>
                            <span className="text-xs text-gray-400">5分</span>
                          </div>
                          <p className="text-sm text-gray-800 mb-2">{q.question}</p>
                          <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
                            {OPTION_LABELS.map((label, i) => (
                              <span
                                key={label}
                                className={`text-xs ${q.answer.includes(label) ? 'text-green-700 font-semibold' : 'text-gray-500'}`}
                              >
                                {label}. {q.options[i]}
                                {q.answer.includes(label) && ' ✓'}
                              </span>
                            ))}
                          </div>
                        </div>
                        <div className="flex gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => { setEditingId(q.id); setShowAddForm(false) }}
                            className="text-xs text-blue-600 hover:text-blue-800 px-2 py-1 rounded hover:bg-blue-50"
                          >
                            编辑
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteQuestion(q.id)}
                            className="text-xs text-red-500 hover:text-red-700 px-2 py-1 rounded hover:bg-red-50"
                          >
                            删除
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 操作按钮 */}
      <div className="flex gap-3 justify-between">
        <div className="flex gap-3">
          <button
            type="submit"
            disabled={isSubmitting}
            className="btn-primary"
          >
            {isSubmitting ? '保存中...' : task ? '保存修改' : '创建任务'}
          </button>
          <button
            type="button"
            onClick={() => router.back()}
            className="btn-secondary"
          >
            取消
          </button>
        </div>

        {task && (
          <button
            type="button"
            onClick={handleDelete}
            disabled={isDeleting}
            className="btn bg-red-600 text-white hover:bg-red-700"
          >
            {isDeleting ? '删除中...' : '删除任务'}
          </button>
        )}
      </div>
    </form>
  )
}
