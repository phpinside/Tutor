'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createTaskConfig, updateTaskConfig, deleteTaskConfig } from '@/app/actions/config'

interface TaskConfigFormProps {
  task?: any
}

const TASK_TYPES = [
  { value: 'INFO', label: '了解信息' },
  { value: 'FORM', label: '填写表单' },
  { value: 'VIDEO_UPLOAD', label: '视频上传' },
  { value: 'TRAINING', label: '观看培训' },
  { value: 'PRACTICE', label: '练习操作' }
]

export default function TaskConfigForm({ task }: TaskConfigFormProps) {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  
  const [formData, setFormData] = useState({
    index: task?.index || 0,
    title: task?.title || '',
    phase: task?.phase || 1,
    emoji: task?.emoji || '📚',
    type: task?.type || 'INFO',
    description: task?.description || '',
    estimatedMinutes: task?.estimatedMinutes || 5,
    isOptional: task?.isOptional || false,
    requirements: task?.requirements ? (task.requirements as string[]).join('\n') : '',
    isActive: task?.isActive !== false,
    sortOrder: task?.sortOrder || 0
  })
  
  const handleChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }
  
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
        requirements
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
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          基本信息
        </h2>
        
        <div className="grid grid-cols-2 gap-4">
          {/* 任务索引 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              任务索引 <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              value={formData.index}
              onChange={(e) => handleChange('index', parseInt(e.target.value))}
              className="input"
              required
              min="0"
            />
            <p className="text-xs text-gray-500 mt-1">
              从0开始的整数,决定任务顺序
            </p>
          </div>
          
          {/* 阶段 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              所属阶段 <span className="text-red-500">*</span>
            </label>
            <select
              value={formData.phase}
              onChange={(e) => handleChange('phase', parseInt(e.target.value))}
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
              onChange={(e) => handleChange('estimatedMinutes', parseInt(e.target.value))}
              className="input"
              required
              min="1"
            />
          </div>
          
          {/* 排序 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              排序权重
            </label>
            <input
              type="number"
              value={formData.sortOrder}
              onChange={(e) => handleChange('sortOrder', parseInt(e.target.value))}
              className="input"
              min="0"
            />
            <p className="text-xs text-gray-500 mt-1">
              数字越小越靠前
            </p>
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
          <p className="text-xs text-gray-500 mt-1">
            每行输入一条要求,系统会自动解析为列表
          </p>
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
            <span className="text-sm text-gray-700">
              标记为可选任务
            </span>
          </label>
          
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={formData.isActive}
              onChange={(e) => handleChange('isActive', e.target.checked)}
              className="w-4 h-4 text-primary-600 rounded focus:ring-primary-500"
            />
            <span className="text-sm text-gray-700">
              启用此任务
            </span>
          </label>
        </div>
      </div>
      
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


