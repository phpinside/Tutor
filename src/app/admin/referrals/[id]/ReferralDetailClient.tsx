'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { updateReferralStatus, markRewardSent } from '@/app/actions/referral'

export default function ReferralDetailClient({ referral }: { referral: any }) {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [showNoteInput, setShowNoteInput] = useState(false)
  const [note, setNote] = useState(referral.adminNote || '')
  
  // 处理标记无效
  const handleMarkInvalid = async () => {
    if (!note.trim()) {
      alert('请输入标记为无效的理由')
      return
    }
    
    if (!confirm('确定要标记为无效邀请吗？')) return
    
    setIsLoading(true)
    const result = await updateReferralStatus(referral.id, 'INVALID', note)
    setIsLoading(false)
    
    if (result.success) {
      alert('已标记为无效邀请')
      setShowNoteInput(false)
      router.refresh()
    } else {
      alert('操作失败：' + result.error)
    }
  }
  
  // 处理恢复有效
  const handleMarkValid = async () => {
    if (!confirm('确定要恢复为有效邀请吗？')) return
    
    setIsLoading(true)
    const result = await updateReferralStatus(referral.id, 'VALID')
    setIsLoading(false)
    
    if (result.success) {
      alert('已恢复为有效邀请')
      router.refresh()
    } else {
      alert('操作失败：' + result.error)
    }
  }
  
  // 处理标记已发放奖励
  const handleMarkRewardSent = async () => {
    if (!confirm('确定已发放奖励吗？此操作不可撤销。')) return
    
    setIsLoading(true)
    const result = await markRewardSent(referral.id)
    setIsLoading(false)
    
    if (result.success) {
      alert('已标记为已发放奖励')
      router.refresh()
    } else {
      alert('操作失败：' + result.error)
    }
  }
  
  // 更新备注
  const handleUpdateNote = async () => {
    if (!note.trim()) {
      alert('请输入备注内容')
      return
    }
    
    setIsLoading(true)
    const result = await updateReferralStatus(referral.id, referral.status, note)
    setIsLoading(false)
    
    if (result.success) {
      alert('备注已更新')
      setShowNoteInput(false)
      router.refresh()
    } else {
      alert('操作失败：' + result.error)
    }
  }
  
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">🔧 管理操作</h2>
      
      {/* 备注编辑区域 */}
      {showNoteInput ? (
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            管理员备注
          </label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
            placeholder="输入备注内容..."
          />
          <div className="flex gap-2 mt-2">
            <button
              onClick={handleUpdateNote}
              disabled={isLoading}
              className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
            >
              保存备注
            </button>
            <button
              onClick={() => {
                setShowNoteInput(false)
                setNote(referral.adminNote || '')
              }}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
            >
              取消
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setShowNoteInput(true)}
          className="mb-4 text-sm text-primary-600 hover:text-primary-700"
        >
          {referral.adminNote ? '编辑备注' : '添加备注'}
        </button>
      )}
      
      {/* 操作按钮 */}
      <div className="flex flex-wrap gap-3">
        {referral.status === 'VALID' ? (
          <button
            onClick={() => setShowNoteInput(true)}
            disabled={isLoading}
            className="px-4 py-2 bg-warning-600 text-white rounded-lg hover:bg-warning-700 disabled:opacity-50"
          >
            标记为无效
          </button>
        ) : (
          <button
            onClick={handleMarkValid}
            disabled={isLoading}
            className="px-4 py-2 bg-success-600 text-white rounded-lg hover:bg-success-700 disabled:opacity-50"
          >
            恢复为有效
          </button>
        )}
        
        {!referral.rewardSent && referral.status === 'VALID' && (
          <button
            onClick={handleMarkRewardSent}
            disabled={isLoading}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            标记已发放奖励
          </button>
        )}
      </div>
      
      {showNoteInput && referral.status === 'INVALID' && (
        <div className="mt-4 text-sm text-gray-600">
          提示：标记为无效时需要填写备注说明理由
        </div>
      )}
    </div>
  )
}
