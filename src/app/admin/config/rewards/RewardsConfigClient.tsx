'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { updateRewardConfigs } from '@/app/actions/systemConfig'

export default function RewardsConfigClient({
  configs
}: {
  configs: {
    directReward: number
    indirectReward: number
  }
}) {
  const router = useRouter()
  const [formData, setFormData] = useState(configs)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)

  const handleSave = async () => {
    if (formData.directReward < 0 || formData.indirectReward < 0) {
      setMessage({ type: 'error', text: '奖励金额不能为负数' })
      return
    }

    setLoading(true)
    setMessage(null)

    const result = await updateRewardConfigs(formData)

    setLoading(false)

    if (result.success) {
      setMessage({ type: 'success', text: '保存成功！' })
      router.refresh()
    } else {
      setMessage({ type: 'error', text: result.error || '保存失败' })
    }
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">💰 邀请奖励配置</h1>
        <p className="text-gray-600 mt-1">设置直接邀请和间接邀请的奖励金额</p>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 max-w-2xl">
        {message && (
          <div className={`mb-4 p-4 rounded-lg ${
            message.type === 'success' 
              ? 'bg-success-50 border border-success-200 text-success-800'
              : 'bg-red-50 border border-red-200 text-red-800'
          }`}>
            {message.text}
          </div>
        )}

        <div className="space-y-6">
          {/* 直接邀请奖励 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              直接邀请奖励（元）
            </label>
            <div className="flex items-center gap-4">
              <input
                type="number"
                min="0"
                step="0.01"
                value={formData.directReward}
                onChange={(e) => setFormData(prev => ({ ...prev, directReward: parseFloat(e.target.value) || 0 }))}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
              <span className="text-gray-600">元/人</span>
            </div>
            <p className="text-sm text-gray-500 mt-1">
              A邀请B完成任务后，A获得的奖励金额
            </p>
          </div>

          {/* 间接邀请奖励 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              间接邀请奖励（元）
            </label>
            <div className="flex items-center gap-4">
              <input
                type="number"
                min="0"
                step="0.01"
                value={formData.indirectReward}
                onChange={(e) => setFormData(prev => ({ ...prev, indirectReward: parseFloat(e.target.value) || 0 }))}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
              <span className="text-gray-600">元/人</span>
            </div>
            <p className="text-sm text-gray-500 mt-1">
              A邀请B，B邀请C完成任务后，A获得的间接奖励金额
            </p>
          </div>

          {/* 说明 */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-blue-900 mb-2">💡 奖励规则说明</h3>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>• <strong>直接邀请：</strong>A邀请B注册并完成任务，A获得直接邀请奖励</li>
              <li>• <strong>间接邀请：</strong>A邀请B，B邀请C注册并完成任务，A获得间接邀请奖励</li>
              <li>• 仅支持2级邀请（A→B→C），不支持更多层级</li>
              <li>• 间接邀请在直接邀请被审核为有效时自动生效</li>
            </ul>
          </div>

          {/* 保存按钮 */}
          <button
            onClick={handleSave}
            disabled={loading}
            className="w-full bg-primary-600 text-white py-3 px-6 rounded-lg hover:bg-primary-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? '保存中...' : '保存配置'}
          </button>
        </div>
      </div>
    </div>
  )
}
