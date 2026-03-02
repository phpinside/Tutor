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
  
  // 表单数据
  const [formData, setFormData] = useState({
    // 基础信息
    name: teacher.name || '',
    phone: teacher.phone || '',
    gender: teacher.gender || '',
    age: teacher.age || '',
    school: teacher.school || '',
    graduationYear: teacher.graduationYear || '',
    identity: teacher.identity || '',
    
    // 教学能力 & 资质
    mathScore: teacher.mathScore ?? 0,
    mathCompetition: teacher.mathCompetition || '',
    teachingExperience: teacher.teachingExperience || '',
    gradePreference: teacher.gradePreference ? teacher.gradePreference.split(',') : [],
    teachingStrengths: teacher.teachingStrengths ? teacher.teachingStrengths.split(',') : [],
    teachingStyle: teacher.teachingStyle || '',
    studentTypes: teacher.studentTypes ? teacher.studentTypes.split(',') : [],
    
    // 可辅导时间
    weekdayTime: teacher.weekdayTime || '',
    weekendTime: teacher.weekendTime || '',
    holidayTime: teacher.holidayTime || ''
  })
  
  const handleChange = (field: string, value: string | number) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }
  
  // 处理多选框变化
  const handleCheckboxChange = (field: string, value: string) => {
    setFormData(prev => {
      const currentValues = Array.isArray(prev[field as keyof typeof prev]) 
        ? prev[field as keyof typeof prev] as string[]
        : []
      const newValues = currentValues.includes(value)
        ? currentValues.filter(v => v !== value)
        : [...currentValues, value]
      return { ...prev, [field]: newValues }
    })
  }
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // 验证必填项
    const grades = Array.isArray(formData.gradePreference) ? formData.gradePreference : []
    if (!formData.name || !formData.phone || !formData.gender || !formData.age || !formData.school || !formData.identity) {
      alert('请填写所有基础信息的必填项')
      return
    }
    
    if (!formData.mathScore || grades.length === 0) {
      alert('请填写高考数学成绩并至少选择一个可辅导学段')
      return
    }
    
    setIsSubmitting(true)
    
    try {
      // 将数组转为逗号分隔的字符串
      const teacherData = {
        ...formData,
        gradePreference: (formData.gradePreference as string[]).join(','),
        teachingStrengths: (formData.teachingStrengths as string[]).join(','),
        studentTypes: (formData.studentTypes as string[]).join(',')
      }
      
      // 更新老师信息
      const updateResult = await updateTeacherInfo(teacherId, teacherData as any)
      
      if (!updateResult.success) {
        alert(updateResult.error || '更新个人信息失败，请重试')
        return
      }
      
      // 提交任务（会自动推进到下一个任务）
      const result = await submitTask(teacherId, task.index, {
        taskType: task.type,
        formData: teacherData
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
      {/* 一、基础信息 */}
      <div className="card">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          一、基础信息
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
              placeholder="请输入你的真实姓名"
              className="input"
              required
            />
          </div>
          
          {/* 联系电话 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              联系电话 <span className="text-red-500">*</span>
            </label>
            <input
              type="tel"
              value={formData.phone}
              onChange={(e) => handleChange('phone', e.target.value)}
              placeholder="请输入手机号"
              className="input"
              required
            />
          </div>
          
          {/* 性别 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              性别 <span className="text-red-500">*</span>
            </label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="gender"
                  value="男"
                  checked={formData.gender === '男'}
                  onChange={(e) => handleChange('gender', e.target.value)}
                  className="w-4 h-4 text-primary-600 border-gray-300 focus:ring-primary-500"
                  required
                />
                <span className="text-sm text-gray-700">男</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="gender"
                  value="女"
                  checked={formData.gender === '女'}
                  onChange={(e) => handleChange('gender', e.target.value)}
                  className="w-4 h-4 text-primary-600 border-gray-300 focus:ring-primary-500"
                />
                <span className="text-sm text-gray-700">女</span>
              </label>
            </div>
          </div>
          
          {/* 年龄 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              年龄 <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              value={formData.age}
              onChange={(e) => handleChange('age', e.target.value)}
              placeholder="请输入年龄"
              className="input"
              min="18"
              max="60"
              required
            />
          </div>
          
          {/* 学历 / 学校 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              学历 / 学校 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.school}
              onChange={(e) => handleChange('school', e.target.value)}
              placeholder="如: 北京大学 数学与应用数学"
              className="input"
              required
            />
            <p className="text-xs text-gray-500 mt-1">
              请填写在读或毕业学校+专业
            </p>
          </div>
          
          {/* 毕业年份 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              毕业年份
            </label>
            <input
              type="number"
              value={formData.graduationYear}
              onChange={(e) => handleChange('graduationYear', e.target.value)}
              placeholder="如: 2024"
              className="input"
              min="2000"
              max="2030"
            />
          </div>
          
          {/* 身份 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              身份 <span className="text-red-500">*</span>
            </label>
            <div className="flex flex-wrap gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="identity"
                  value="在读学生"
                  checked={formData.identity === '在读学生'}
                  onChange={(e) => handleChange('identity', e.target.value)}
                  className="w-4 h-4 text-primary-600 border-gray-300 focus:ring-primary-500"
                  required
                />
                <span className="text-sm text-gray-700">在读学生</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="identity"
                  value="毕业生"
                  checked={formData.identity === '毕业生'}
                  onChange={(e) => handleChange('identity', e.target.value)}
                  className="w-4 h-4 text-primary-600 border-gray-300 focus:ring-primary-500"
                />
                <span className="text-sm text-gray-700">毕业生</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="identity"
                  value="其他"
                  checked={formData.identity === '其他'}
                  onChange={(e) => handleChange('identity', e.target.value)}
                  className="w-4 h-4 text-primary-600 border-gray-300 focus:ring-primary-500"
                />
                <span className="text-sm text-gray-700">其他</span>
              </label>
            </div>
          </div>
        </div>
      </div>
      
      {/* 二、教学能力 & 资质 */}
      <div className="card">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          二、教学能力 & 资质
        </h2>
        
        <div className="space-y-4">
          {/* 高考数学成绩 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              高考数学成绩 <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              value={formData.mathScore}
              onChange={(e) => handleChange('mathScore', parseInt(e.target.value) || 0)}
              placeholder="如: 103"
              className="input"
              min="0"
              max="150"
              required
            />
            <p className="text-xs text-gray-500 mt-1">
              请填写分数，满分150分
            </p>
          </div>
          
          {/* 数学竞赛经历 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              数学竞赛经历
            </label>
            <input
              type="text"
              value={formData.mathCompetition}
              onChange={(e) => handleChange('mathCompetition', e.target.value)}
              placeholder="如: 县三等奖 / 市一等奖"
              className="input"
            />
          </div>
          
          {/* 教学经验 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              教学经验
            </label>
            <textarea
              value={formData.teachingExperience}
              onChange={(e) => handleChange('teachingExperience', e.target.value)}
              placeholder="例：累计辅导3+学生，平均提分15分"
              className="textarea"
              rows={3}
            />
          </div>
          
          {/* 可辅导学段 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              可辅导学段 <span className="text-red-500">*</span>
            </label>
            <div className="space-y-2">
              {['小学', '初中', '高中'].map(grade => (
                <label
                  key={grade}
                  className="flex items-center gap-2 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={Array.isArray(formData.gradePreference) && formData.gradePreference.includes(grade)}
                    onChange={() => handleCheckboxChange('gradePreference', grade)}
                    className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                  />
                  <span className="text-sm text-gray-700">{grade}</span>
                </label>
              ))}
            </div>
            <p className="text-xs text-gray-500 mt-1">
              可多选，至少选择一个学段
            </p>
          </div>
          
          {/* 擅长方向 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              擅长方向
            </label>
            <div className="space-y-2">
              {['基础巩固', '查漏补缺', '应试提分', '思维训练', '作业陪跑'].map(strength => (
                <label
                  key={strength}
                  className="flex items-center gap-2 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={Array.isArray(formData.teachingStrengths) && formData.teachingStrengths.includes(strength)}
                    onChange={() => handleCheckboxChange('teachingStrengths', strength)}
                    className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                  />
                  <span className="text-sm text-gray-700">{strength}</span>
                </label>
              ))}
            </div>
            <p className="text-xs text-gray-500 mt-1">
              可多选
            </p>
          </div>
          
          {/* 教学风格 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              教学风格
            </label>
            <div className="space-y-2">
              {['严格型', '温和鼓励型', '引导思考型'].map(style => (
                <label
                  key={style}
                  className="flex items-center gap-2 cursor-pointer"
                >
                  <input
                    type="radio"
                    name="teachingStyle"
                    value={style}
                    checked={formData.teachingStyle === style}
                    onChange={(e) => handleChange('teachingStyle', e.target.value)}
                    className="w-4 h-4 text-primary-600 border-gray-300 focus:ring-primary-500"
                  />
                  <span className="text-sm text-gray-700">{style}</span>
                </label>
              ))}
            </div>
          </div>
          
          {/* 擅长学生类型 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              擅长学生类型
            </label>
            <div className="space-y-2">
              {['基础薄弱', '厌学学生', '提分冲刺', '普通学生'].map(type => (
                <label
                  key={type}
                  className="flex items-center gap-2 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={Array.isArray(formData.studentTypes) && formData.studentTypes.includes(type)}
                    onChange={() => handleCheckboxChange('studentTypes', type)}
                    className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                  />
                  <span className="text-sm text-gray-700">{type}</span>
                </label>
              ))}
            </div>
            <p className="text-xs text-gray-500 mt-1">
              可多选
            </p>
          </div>
        </div>
      </div>
      
      {/* 三、可辅导时间 */}
      <div className="card">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          三、可辅导时间
        </h2>
        
        <div className="space-y-4">
          {/* 周一到周五 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              周一到周五
            </label>
            <input
              type="text"
              value={formData.weekdayTime}
              onChange={(e) => handleChange('weekdayTime', e.target.value)}
              placeholder="如: 晚上 18:30-21:30"
              className="input"
            />
          </div>
          
          {/* 周末 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              周末
            </label>
            <input
              type="text"
              value={formData.weekendTime}
              onChange={(e) => handleChange('weekendTime', e.target.value)}
              placeholder="如: 全天可用"
              className="input"
            />
          </div>
          
          {/* 寒暑假 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              寒暑假
            </label>
            <input
              type="text"
              value={formData.holidayTime}
              onChange={(e) => handleChange('holidayTime', e.target.value)}
              placeholder="如: 灵活安排，根据需求"
              className="input"
            />
          </div>
          
          <p className="text-xs text-gray-500">
            填写你大致可以辅导的时间段，后续可以灵活调整
          </p>
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

