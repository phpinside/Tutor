'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { setTeacherInviter } from '@/app/actions/teacher'

interface InviterInfo {
  id: string
  name: string | null
  phone: string | null
}

interface SetInviterModalProps {
  teacherId: string
  currentInviter: InviterInfo | null
}

export default function SetInviterModal({ teacherId, currentInviter }: SetInviterModalProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [inviterId, setInviterId] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async () => {
    if (!inviterId.trim()) {
      alert('请输入邀请人 ID')
      return
    }

    if (currentInviter && !confirm(`该教师已有邀请人（${currentInviter.name || currentInviter.id}），确定要覆盖邀请人吗？`)) {
      return
    }

    setIsLoading(true)
    const result = await setTeacherInviter(teacherId, inviterId.trim())
    setIsLoading(false)

    if (result.success) {
      alert(`邀请人已设置为：${result.inviterName}`)
      setOpen(false)
      setInviterId('')
      router.refresh()
    } else {
      alert('操作失败：' + result.error)
    }
  }

  const handleClose = () => {
    setOpen(false)
    setInviterId('')
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors"
      >
        设置邀请人
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* 遮罩 */}
          <div
            className="absolute inset-0 bg-black/40"
            onClick={handleClose}
          />

          {/* 弹窗 */}
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md mx-4 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">设置邀请人</h2>

            {/* 当前邀请人信息 */}
            {currentInviter ? (
              <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm">
                <p className="text-amber-700 font-medium mb-1">当前邀请人</p>
                <p className="text-amber-900">
                  {currentInviter.name || '未命名'} · {currentInviter.id}
                </p>
                {currentInviter.phone && (
                  <p className="text-amber-700">{currentInviter.phone}</p>
                )}
              </div>
            ) : (
              <div className="mb-4 p-3 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-500">
                暂无邀请人
              </div>
            )}

            {/* 输入邀请人 ID */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                邀请人 ID
              </label>
              <input
                type="text"
                value={inviterId}
                onChange={e => setInviterId(e.target.value)}
                placeholder="请输入邀请人的 ID"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                onKeyDown={e => e.key === 'Enter' && handleSubmit()}
                autoFocus
              />
            </div>

            {/* 操作按钮 */}
            <div className="flex gap-3 justify-end">
              <button
                onClick={handleClose}
                disabled={isLoading}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50"
              >
                取消
              </button>
              <button
                onClick={handleSubmit}
                disabled={isLoading}
                className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50"
              >
                {isLoading ? '设置中...' : '确定'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
