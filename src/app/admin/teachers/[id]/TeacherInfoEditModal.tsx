'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { updateTeacherInfo } from '@/app/actions/teacher'

const SUBJECT_OPTIONS = [
  { value: 'MATH', label: '数学' },
  { value: 'PHYSICS', label: '物理' },
  { value: 'CHEMISTRY', label: '化学' },
]

const GRADE_OPTIONS = ['小学', '初中', '高中']
const STRENGTH_OPTIONS = ['基础巩固', '查漏补缺', '应试提分', '思维训练', '作业陪跑']
const STYLE_OPTIONS = ['严格型', '温和鼓励型', '引导思考型']
const STUDENT_TYPE_OPTIONS = ['基础薄弱', '厌学学生', '提分冲刺', '普通学生']

interface TeacherData {
  name: string | null
  phone: string
  gender: string | null
  age: number | null
  school: string | null
  graduationYear: string | null
  identity: string | null
  subjects: string[]
  primarySubject: string | null
  mathScore: number | null
  physicsScore: number | null
  chemistryScore: number | null
  scienceCompetition: string | null
  teachingExperience: string | null
  gradePreference: string | null
  teachingStrengths: string | null
  teachingStyle: string | null
  studentTypes: string | null
  weekdayTime: string | null
  weekendTime: string | null
  holidayTime: string | null
}

interface Props {
  teacherId: string
  teacher: TeacherData
}

export default function TeacherInfoEditModal({ teacherId, teacher }: Props) {
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  const [formData, setFormData] = useState({
    name: teacher.name || '',
    phone: teacher.phone || '',
    gender: teacher.gender || '',
    age: teacher.age != null ? String(teacher.age) : '',
    school: teacher.school || '',
    graduationYear: teacher.graduationYear || '',
    identity: teacher.identity || '',
    subjects: teacher.subjects ?? [],
    primarySubject: teacher.primarySubject || '',
    mathScore: teacher.mathScore ?? 0,
    physicsScore: teacher.physicsScore ?? 0,
    chemistryScore: teacher.chemistryScore ?? 0,
    scienceCompetition: teacher.scienceCompetition || '',
    teachingExperience: teacher.teachingExperience || '',
    gradePreference: teacher.gradePreference ? teacher.gradePreference.split(',') : [],
    teachingStrengths: teacher.teachingStrengths ? teacher.teachingStrengths.split(',') : [],
    teachingStyle: teacher.teachingStyle || '',
    studentTypes: teacher.studentTypes ? teacher.studentTypes.split(',') : [],
    weekdayTime: teacher.weekdayTime || '',
    weekendTime: teacher.weekendTime || '',
    holidayTime: teacher.holidayTime || '',
  })

  const handleChange = (field: string, value: string | number) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const handleCheckboxChange = (field: 'gradePreference' | 'teachingStrengths' | 'studentTypes', value: string) => {
    setFormData(prev => {
      const current = prev[field] as string[]
      const next = current.includes(value) ? current.filter(v => v !== value) : [...current, value]
      return { ...prev, [field]: next }
    })
  }

  const handleSubjectToggle = (value: string) => {
    setFormData(prev => {
      const newSubjects = prev.subjects.includes(value)
        ? prev.subjects.filter(s => s !== value)
        : [...prev.subjects, value]
      const newPrimary = newSubjects.includes(prev.primarySubject) ? prev.primarySubject : ''
      return { ...prev, subjects: newSubjects, primarySubject: newPrimary }
    })
  }

  const handleOpen = () => {
    // Re-sync state from latest teacher prop each time modal opens
    setFormData({
      name: teacher.name || '',
      phone: teacher.phone || '',
      gender: teacher.gender || '',
      age: teacher.age != null ? String(teacher.age) : '',
      school: teacher.school || '',
      graduationYear: teacher.graduationYear || '',
      identity: teacher.identity || '',
      subjects: teacher.subjects ?? [],
      primarySubject: teacher.primarySubject || '',
      mathScore: teacher.mathScore ?? 0,
      physicsScore: teacher.physicsScore ?? 0,
      chemistryScore: teacher.chemistryScore ?? 0,
      scienceCompetition: teacher.scienceCompetition || '',
      teachingExperience: teacher.teachingExperience || '',
      gradePreference: teacher.gradePreference ? teacher.gradePreference.split(',') : [],
      teachingStrengths: teacher.teachingStrengths ? teacher.teachingStrengths.split(',') : [],
      teachingStyle: teacher.teachingStyle || '',
      studentTypes: teacher.studentTypes ? teacher.studentTypes.split(',') : [],
      weekdayTime: teacher.weekdayTime || '',
      weekendTime: teacher.weekendTime || '',
      holidayTime: teacher.holidayTime || '',
    })
    setErrorMsg('')
    setIsOpen(true)
  }

  const handleClose = () => {
    if (isSubmitting) return
    setIsOpen(false)
    setErrorMsg('')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg('')

    const ageNum = formData.age.trim() ? parseInt(formData.age.trim(), 10) : undefined
    if (formData.age.trim() && (!Number.isFinite(ageNum) || (ageNum as number) < 18 || (ageNum as number) > 60)) {
      setErrorMsg('年龄需在 18–60 之间')
      return
    }

    setIsSubmitting(true)
    try {
      const result = await updateTeacherInfo(teacherId, {
        name: formData.name || undefined,
        phone: formData.phone || undefined,
        gender: formData.gender || undefined,
        age: ageNum,
        school: formData.school || undefined,
        graduationYear: formData.graduationYear || undefined,
        identity: formData.identity || undefined,
        subjects: formData.subjects,
        primarySubject: formData.primarySubject || undefined,
        mathScore: formData.mathScore || undefined,
        physicsScore: formData.physicsScore || undefined,
        chemistryScore: formData.chemistryScore || undefined,
        scienceCompetition: formData.scienceCompetition || undefined,
        teachingExperience: formData.teachingExperience || undefined,
        gradePreference: (formData.gradePreference as string[]).join(',') || undefined,
        teachingStrengths: (formData.teachingStrengths as string[]).join(',') || undefined,
        teachingStyle: formData.teachingStyle || undefined,
        studentTypes: (formData.studentTypes as string[]).join(',') || undefined,
        weekdayTime: formData.weekdayTime || undefined,
        weekendTime: formData.weekendTime || undefined,
        holidayTime: formData.holidayTime || undefined,
      })

      if (result.success) {
        setIsOpen(false)
        router.refresh()
      } else {
        setErrorMsg(result.error || '保存失败，请重试')
      }
    } catch {
      setErrorMsg('保存失败，请重试')
    } finally {
      setIsSubmitting(false)
    }
  }

  const scoreInput = (field: 'mathScore' | 'physicsScore' | 'chemistryScore', max: number) => (
    <input
      type="text"
      inputMode="numeric"
      pattern="[0-9]*"
      value={(formData[field] as number) === 0 ? '' : formData[field]}
      onChange={(e) => {
        const val = e.target.value.replace(/[^0-9]/g, '')
        const num = val === '' ? 0 : Math.min(max, parseInt(val))
        handleChange(field, num)
      }}
      className="input"
    />
  )

  return (
    <>
      <button
        onClick={handleOpen}
        className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium"
      >
        编辑信息
      </button>

      {isOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl flex flex-col max-h-[90vh]">
            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b border-gray-100 flex-shrink-0">
              <h3 className="text-base font-bold text-gray-900">编辑老师信息</h3>
              <button onClick={handleClose} className="text-gray-400 hover:text-gray-600 text-lg">✕</button>
            </div>

            {/* Scrollable form body */}
            <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
              <div className="overflow-y-auto flex-1 p-5 space-y-6">

                {/* 一、基础信息 */}
                <div>
                  <h4 className="text-sm font-semibold text-gray-700 mb-3 pb-1 border-b border-gray-100">基础信息</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">姓名</label>
                      <input type="text" value={formData.name} onChange={e => handleChange('name', e.target.value)} className="input" placeholder="请输入姓名" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">联系电话</label>
                      <input type="tel" value={formData.phone} onChange={e => handleChange('phone', e.target.value)} className="input" placeholder="手机号" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">性别</label>
                      <div className="flex gap-4">
                        {['男', '女'].map(g => (
                          <label key={g} className="flex items-center gap-2 cursor-pointer">
                            <input type="radio" name="edit-gender" value={g} checked={formData.gender === g} onChange={e => handleChange('gender', e.target.value)} className="w-4 h-4 text-primary-600 border-gray-300 focus:ring-primary-500" />
                            <span className="text-sm text-gray-700">{g}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">年龄</label>
                      <input type="number" value={formData.age} onChange={e => handleChange('age', e.target.value)} className="input" placeholder="18–60" min={18} max={60} />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-1">学历 / 学校</label>
                      <input type="text" value={formData.school} onChange={e => handleChange('school', e.target.value)} className="input" placeholder="如：北京大学 数学与应用数学" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">毕业年份</label>
                      <input type="number" value={formData.graduationYear} onChange={e => handleChange('graduationYear', e.target.value)} className="input" placeholder="如：2024" min={2000} max={2030} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">身份</label>
                      <div className="flex flex-wrap gap-4">
                        {['在读学生', '毕业生', '其他'].map(id => (
                          <label key={id} className="flex items-center gap-2 cursor-pointer">
                            <input type="radio" name="edit-identity" value={id} checked={formData.identity === id} onChange={e => handleChange('identity', e.target.value)} className="w-4 h-4 text-primary-600 border-gray-300 focus:ring-primary-500" />
                            <span className="text-sm text-gray-700">{id}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* 二、学科信息 */}
                <div>
                  <h4 className="text-sm font-semibold text-gray-700 mb-3 pb-1 border-b border-gray-100">学科信息</h4>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">可教学科</label>
                      <div className="flex gap-6">
                        {SUBJECT_OPTIONS.map(opt => (
                          <label key={opt.value} className="flex items-center gap-2 cursor-pointer">
                            <input type="checkbox" checked={formData.subjects.includes(opt.value)} onChange={() => handleSubjectToggle(opt.value)} className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500" />
                            <span className="text-sm text-gray-700">{opt.label}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                    {formData.subjects.length > 0 && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">最擅长学科</label>
                        <div className="flex gap-6">
                          {SUBJECT_OPTIONS.filter(opt => formData.subjects.includes(opt.value)).map(opt => (
                            <label key={opt.value} className="flex items-center gap-2 cursor-pointer">
                              <input type="radio" name="edit-primarySubject" value={opt.value} checked={formData.primarySubject === opt.value} onChange={e => handleChange('primarySubject', e.target.value)} className="w-4 h-4 text-primary-600 border-gray-300 focus:ring-primary-500" />
                              <span className="text-sm text-gray-700">{opt.label}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* 三、教学能力 & 资质 */}
                <div>
                  <h4 className="text-sm font-semibold text-gray-700 mb-3 pb-1 border-b border-gray-100">教学能力 & 资质</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">高考数学成绩</label>
                      {scoreInput('mathScore', 150)}
                      <p className="text-xs text-gray-400 mt-1">满分 150 分</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">高考物理成绩</label>
                      {scoreInput('physicsScore', 150)}
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">高考化学成绩</label>
                      {scoreInput('chemistryScore', 150)}
                    </div>
                    <div className="sm:col-span-3">
                      <label className="block text-sm font-medium text-gray-700 mb-1">数理化竞赛经历</label>
                      <input type="text" value={formData.scienceCompetition} onChange={e => handleChange('scienceCompetition', e.target.value)} className="input" placeholder="如：数学联赛省二等奖 / 物理竞赛市一等奖" />
                    </div>
                    <div className="sm:col-span-3">
                      <label className="block text-sm font-medium text-gray-700 mb-1">教学经验</label>
                      <textarea value={formData.teachingExperience} onChange={e => handleChange('teachingExperience', e.target.value)} className="textarea" rows={3} placeholder="例：累计辅导3+学生，平均提分15分" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">可辅导学段</label>
                      <div className="space-y-1.5">
                        {GRADE_OPTIONS.map(g => (
                          <label key={g} className="flex items-center gap-2 cursor-pointer">
                            <input type="checkbox" checked={(formData.gradePreference as string[]).includes(g)} onChange={() => handleCheckboxChange('gradePreference', g)} className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500" />
                            <span className="text-sm text-gray-700">{g}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">擅长方向</label>
                      <div className="space-y-1.5">
                        {STRENGTH_OPTIONS.map(s => (
                          <label key={s} className="flex items-center gap-2 cursor-pointer">
                            <input type="checkbox" checked={(formData.teachingStrengths as string[]).includes(s)} onChange={() => handleCheckboxChange('teachingStrengths', s)} className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500" />
                            <span className="text-sm text-gray-700">{s}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">教学风格</label>
                      <div className="space-y-1.5">
                        {STYLE_OPTIONS.map(s => (
                          <label key={s} className="flex items-center gap-2 cursor-pointer">
                            <input type="radio" name="edit-teachingStyle" value={s} checked={formData.teachingStyle === s} onChange={e => handleChange('teachingStyle', e.target.value)} className="w-4 h-4 text-primary-600 border-gray-300 focus:ring-primary-500" />
                            <span className="text-sm text-gray-700">{s}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                    <div className="sm:col-span-3">
                      <label className="block text-sm font-medium text-gray-700 mb-2">擅长学生类型</label>
                      <div className="flex flex-wrap gap-4">
                        {STUDENT_TYPE_OPTIONS.map(t => (
                          <label key={t} className="flex items-center gap-2 cursor-pointer">
                            <input type="checkbox" checked={(formData.studentTypes as string[]).includes(t)} onChange={() => handleCheckboxChange('studentTypes', t)} className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500" />
                            <span className="text-sm text-gray-700">{t}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* 四、可辅导时间 */}
                <div>
                  <h4 className="text-sm font-semibold text-gray-700 mb-3 pb-1 border-b border-gray-100">可辅导时间</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">周一到周五</label>
                      <input type="text" value={formData.weekdayTime} onChange={e => handleChange('weekdayTime', e.target.value)} className="input" placeholder="如：晚上 18:30–21:30" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">周末</label>
                      <input type="text" value={formData.weekendTime} onChange={e => handleChange('weekendTime', e.target.value)} className="input" placeholder="如：全天可用" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">寒暑假</label>
                      <input type="text" value={formData.holidayTime} onChange={e => handleChange('holidayTime', e.target.value)} className="input" placeholder="如：灵活安排" />
                    </div>
                  </div>
                </div>

              </div>

              {/* Footer */}
              <div className="flex-shrink-0 border-t border-gray-100 p-5 space-y-3">
                {errorMsg && (
                  <p className="text-sm text-red-600">{errorMsg}</p>
                )}
                <div className="flex gap-3">
                  <button type="button" onClick={handleClose} disabled={isSubmitting} className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium disabled:opacity-50">
                    取消
                  </button>
                  <button type="submit" disabled={isSubmitting} className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors text-sm font-medium disabled:opacity-50">
                    {isSubmitting ? '保存中...' : '保存'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
