'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createPhaseConfig, updatePhaseConfig, deletePhaseConfig } from '@/app/actions/config'

interface PhaseConfigFormProps {
  phase?: any
}

export default function PhaseConfigForm({ phase }: PhaseConfigFormProps) {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  
  const [formData, setFormData] = useState({
    phase: phase?.phase || 1,
    title: phase?.title || '',
    description: phase?.description || '',
    sortOrder: phase?.sortOrder || 0,
    isActive: phase?.isActive !== false
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
      let result
      if (phase) {
        result = await updatePhaseConfig(phase.id, formData)
      } else {
        result = await createPhaseConfig(formData)
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
    if (!phase) return
    
    if (!confirm('确定要删除这个阶段吗？此操作不可恢复。')) {
      return
    }
    
    setIsDeleting(true)
    
    try {
      const result = await deletePhaseConfig(phase.id)
      
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
    <form onSubmit={handleSubmit} className="max-w-2xl">
      <div className="card mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          阶段信息
        </h2>
        
        <div className="space-y-4">
          {/* 阶段号 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              阶段号 <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              value={formData.phase}
              onChange={(e) => handleChange('phase', parseInt(e.target.value))}
              className="input"
              required
              min="1"
            />
            <p className="text-xs text-gray-500 mt-1">
              从1开始的整数,决定阶段顺序
            </p>
          </div>
          
          {/* 阶段标题 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              阶段标题 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => handleChange('title', e.target.value)}
              className="input"
              required
              placeholder="如: 认识伴学"
            />
          </div>
          
          {/* 阶段描述 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              阶段描述 <span className="text-red-500">*</span>
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => handleChange('description', e.target.value)}
              className="textarea"
              required
              rows={3}
              placeholder="描述这个阶段的目的和内容..."
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
          
          {/* 启用状态 */}
          <div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.isActive}
                onChange={(e) => handleChange('isActive', e.target.checked)}
                className="w-4 h-4 text-primary-600 rounded focus:ring-primary-500"
              />
              <span className="text-sm text-gray-700">
                启用此阶段
              </span>
            </label>
          </div>
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
            {isSubmitting ? '保存中...' : phase ? '保存修改' : '创建阶段'}
          </button>
          <button
            type="button"
            onClick={() => router.back()}
            className="btn-secondary"
          >
            取消
          </button>
        </div>
        
        {phase && (
          <button
            type="button"
            onClick={handleDelete}
            disabled={isDeleting}
            className="btn bg-red-600 text-white hover:bg-red-700"
          >
            {isDeleting ? '删除中...' : '删除阶段'}
          </button>
        )}
      </div>
    </form>
  )
}


