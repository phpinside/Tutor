'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { submitTask } from '@/app/actions/task'
import { updateTeacherInfo } from '@/app/actions/teacher'
import type { TaskConfig } from '@/lib/config'

interface TaskFormProps {
  task: TaskConfig
  teacherId: string
  teacher: any
  submission: any
}

export default function TaskForm({ task, teacherId, teacher, submission }: TaskFormProps) {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  
  // 年级选项
  const gradeOptions = [
    { value: '小学', label: '小学' },
    { value: '初中', label: '初中' },
    { value: '高中', label: '高中' }
  ]
  
  // 表单数据
  const [formData, setFormData] = useState({
    name: teacher.name || '',
    school: teacher.school || '',
    major: teacher.major || '',
    gradePreference: teacher.gradePreference ? teacher.gradePreference.split(',') : [],
    availableTime: teacher.availableTime || ''
  })
  
  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }
  
  // 处理年级复选框变化
  const handleGradeChange = (grade: string) => {
    setFormData(prev => {
      const currentGrades = Array.isArray(prev.gradePreference) ? prev.gradePreference : []
      const newGrades = currentGrades.includes(grade)
        ? currentGrades.filter(g => g !== grade)
        : [...currentGrades, grade]
      return { ...prev, gradePreference: newGrades }
    })
  }
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // 验证必填项
    const grades = Array.isArray(formData.gradePreference) ? formData.gradePreference : []
    if (!formData.name || !formData.school || grades.length === 0) {
      alert('请填写所有必填项，并至少选择一个擅长年级')
      return
    }
    
    setIsSubmitting(true)
    
    try {
      // 将年级数组转为逗号分隔的字符串
      const teacherData = {
        ...formData,
        gradePreference: grades.join(',')
      }
      
      // 更新老师信息
      await updateTeacherInfo(teacherId, teacherData as any)
      
      // 提交任务（会自动推进到下一个任务）
      const result = await submitTask(teacherId, task.index, {
        taskType: task.type,
        formData
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
      <div className="card">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          基本信息
        </h2>
        
        <div className="space-y-4">
          {/* 姓名 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              姓名 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => handleChange('name', e.target.value)}
              placeholder="请输入你的姓名"
              className="input"
              required
            />
          </div>
          
          {/* 学校 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              学校 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.school}
              onChange={(e) => handleChange('school', e.target.value)}
              placeholder="如: 北京大学"
              className="input"
              required
            />
          </div>
          
          {/* 专业 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              专业
            </label>
            <input
              type="text"
              value={formData.major}
              onChange={(e) => handleChange('major', e.target.value)}
              placeholder="如: 数学与应用数学"
              className="input"
            />
          </div>
          
          {/* 擅长年级 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              擅长年级 <span className="text-red-500">*</span>
            </label>
            <div className="space-y-2">
              {gradeOptions.map(option => (
                <label
                  key={option.value}
                  className="flex items-center gap-2 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={Array.isArray(formData.gradePreference) && formData.gradePreference.includes(option.value)}
                    onChange={() => handleGradeChange(option.value)}
                    className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                  />
                  <span className="text-sm text-gray-700">{option.label}</span>
                </label>
              ))}
            </div>
            <p className="text-xs text-gray-500 mt-1">
              可多选，至少选择一个年级
            </p>
          </div>
          
          {/* 可工作时间 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              可工作时间
            </label>
            <textarea
              value={formData.availableTime}
              onChange={(e) => handleChange('availableTime', e.target.value)}
              placeholder="如: 周一至周五晚上 7-9 点,周末全天"
              className="textarea"
              rows={3}
            />
            <p className="text-xs text-gray-500 mt-1">
              填写你大致可以工作的时间段,后续可以灵活调整
            </p>
          </div>
        </div>
      </div>
      
      {/* 提交按钮 */}
      <div className="flex gap-3">
        <button
          type="submit"
          disabled={isSubmitting}
          className="btn-primary flex-1"
        >
          {isSubmitting ? '提交中...' : '保存并继续'}
        </button>
      </div>
    </form>
  )
}

