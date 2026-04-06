'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { resetTeacherPassword } from '@/app/actions/teacher'

interface Props {
  teacherId: string
  teacherName: string | null
}

export default function ResetTeacherPasswordModal({ teacherId, teacherName }: Props) {
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(false)
  const [newPassword, setNewPassword] = useState('123456')
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState('')

  const open = () => {
    setNewPassword('123456')
    setMsg('')
    setIsOpen(true)
  }

  const close = () => {
    if (loading) return
    setIsOpen(false)
    setNewPassword('123456')
    setMsg('')
  }

  const handleConfirm = async () => {
    if (newPassword.length < 6) {
      setMsg('密码至少 6 位')
      return
    }
    setLoading(true)
    setMsg('')
    const result = await resetTeacherPassword(teacherId, newPassword)
    setLoading(false)
    if (result.success) {
      setMsg(`✅ ${result.message || '密码重置成功'}`)
      setTimeout(() => {
        close()
        router.refresh()
      }, 1200)
    } else {
      setMsg(`❌ ${result.error || '操作失败'}`)
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={open}
        className="px-4 py-2 border border-red-200 text-red-700 rounded-lg hover:bg-red-50 transition-colors text-sm font-medium"
      >
        重置密码
      </button>

      {isOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm">
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <h3 className="text-base font-bold text-gray-900">重置密码</h3>
              <button type="button" onClick={close} className="text-gray-400 hover:text-gray-600" disabled={loading}>
                ✕
              </button>
            </div>
            <div className="p-5 space-y-4">
              <p className="text-sm text-gray-600">
                为 <span className="font-medium text-gray-900">「{teacherName || '该老师'}」</span> 设置新密码：
              </p>
              <input
                type="text"
                value={newPassword}
                onChange={(e) => {
                  setNewPassword(e.target.value)
                  setMsg('')
                }}
                className="input w-full font-mono"
                placeholder="请输入新密码（至少 6 位）"
                autoFocus
              />
              {msg && (
                <p className={`text-sm ${msg.startsWith('✅') ? 'text-green-600' : 'text-red-500'}`}>{msg}</p>
              )}
              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={close}
                  disabled={loading}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium disabled:opacity-50"
                >
                  取消
                </button>
                <button
                  type="button"
                  onClick={handleConfirm}
                  disabled={loading}
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm font-medium disabled:opacity-50"
                >
                  {loading ? '重置中...' : '确认重置'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
