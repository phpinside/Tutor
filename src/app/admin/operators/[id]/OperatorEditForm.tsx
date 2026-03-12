'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { updateOperator, resetOperatorPassword, deleteOperator } from '@/app/actions/adminOperatorActions'

interface OperatorData {
  id: string
  name: string
  phone: string
  isEnabled: boolean
  remarks: string | null
}

export default function OperatorEditForm({ operator }: { operator: OperatorData }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [pwdLoading, setPwdLoading] = useState(false)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [showPwdSection, setShowPwdSection] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [isEnabled, setIsEnabled] = useState(operator.isEnabled)

  async function handleUpdate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setMessage('')

    const form = e.currentTarget
    const data = {
      name: (form.elements.namedItem('name') as HTMLInputElement).value.trim(),
      isEnabled,
      remarks: (form.elements.namedItem('remarks') as HTMLTextAreaElement).value.trim() || undefined,
    }

    await updateOperator(operator.id, data)
    setMessage('保存成功')
    setLoading(false)
  }

  async function handleResetPassword() {
    if (!newPassword.trim()) return
    setPwdLoading(true)
    await resetOperatorPassword(operator.id, newPassword)
    setNewPassword('')
    setShowPwdSection(false)
    setMessage('密码已重置')
    setPwdLoading(false)
  }

  async function handleDelete() {
    setDeleteLoading(true)
    await deleteOperator(operator.id)
    router.push('/admin/operators')
  }

  return (
    <div className="space-y-6">
      {message && (
        <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">
          {message}
        </div>
      )}

      <form onSubmit={handleUpdate} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">姓名</label>
          <input
            name="name"
            type="text"
            defaultValue={operator.name}
            required
            className="input w-full"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">手机号</label>
          <input
            type="text"
            value={operator.phone}
            disabled
            className="input w-full bg-gray-50 text-gray-400 cursor-not-allowed"
          />
          <p className="text-xs text-gray-400 mt-1">手机号不可修改</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">启用状态</label>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setIsEnabled(!isEnabled)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
                isEnabled ? 'bg-green-500' : 'bg-gray-300'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                  isEnabled ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
            <span className={`text-sm font-medium ${isEnabled ? 'text-green-600' : 'text-gray-400'}`}>
              {isEnabled ? '已启用' : '已禁用（无法登录）'}
            </span>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">备注</label>
          <textarea
            name="remarks"
            rows={3}
            defaultValue={operator.remarks || ''}
            className="input w-full resize-none"
          />
        </div>

        <button type="submit" disabled={loading} className="btn-primary w-full">
          {loading ? '保存中...' : '保存修改'}
        </button>
      </form>

      <div className="border-t border-gray-200 pt-4">
        <button
          onClick={() => setShowPwdSection(!showPwdSection)}
          className="text-sm text-blue-600 hover:text-blue-800 font-medium"
        >
          {showPwdSection ? '收起' : '重置密码'}
        </button>

        {showPwdSection && (
          <div className="mt-3 flex gap-2">
            <input
              type="text"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="input flex-1 font-mono"
              placeholder="输入新密码"
            />
            <button
              onClick={handleResetPassword}
              disabled={pwdLoading || !newPassword.trim()}
              className="btn-secondary"
            >
              {pwdLoading ? '重置中...' : '确认重置'}
            </button>
          </div>
        )}
      </div>

      <div className="border-t border-gray-200 pt-4">
        {!showDeleteConfirm ? (
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="text-sm text-red-500 hover:text-red-700 font-medium"
          >
            删除此运营人员
          </button>
        ) : (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-700 mb-3">确认删除？此操作不可撤销，该运营人员管理的团队老师将自动解绑。</p>
            <div className="flex gap-2">
              <button
                onClick={handleDelete}
                disabled={deleteLoading}
                className="text-sm bg-red-500 text-white px-4 py-1.5 rounded hover:bg-red-600"
              >
                {deleteLoading ? '删除中...' : '确认删除'}
              </button>
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="text-sm text-gray-600 hover:text-gray-900 px-4 py-1.5"
              >
                取消
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
