'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { applyForWithdrawal } from '@/app/actions/teacher'
import Image from 'next/image'

type WithdrawalData = {
  teacher: {
    name: string | null
    phone: string | null
  }
  earnings: {
    totalEarnings: number
    totalWithdrawn: number
    totalPending: number
    availableBalance: number
    validReferralsCount: number
  }
  withdrawals: Array<{
    id: string
    amount: number
    accountName: string
    bankName: string
    cardNumber: string
    phone: string
    status: 'PENDING' | 'APPROVED' | 'REJECTED'
    rejectNote: string | null
    createdAt: Date
    reviewedAt: Date | null
  }>
  latestBankInfo: {
    accountName: string
    bankName: string
    cardNumber: string
    phone: string
    idCard: string
  } | null
  hasPendingWithdrawal: boolean
}

// 中国身份证号码验证
function validateIdCard(idCard: string): boolean {
  if (!/^\d{17}[\dXx]$/.test(idCard)) {
    return false
  }
  
  // 验证校验位
  const weights = [7, 9, 10, 5, 8, 4, 2, 1, 6, 3, 7, 9, 10, 5, 8, 4, 2]
  const checkCodes = ['1', '0', 'X', '9', '8', '7', '6', '5', '4', '3', '2']
  
  let sum = 0
  for (let i = 0; i < 17; i++) {
    sum += parseInt(idCard[i]) * weights[i]
  }
  
  const checkCode = checkCodes[sum % 11]
  return idCard[17].toUpperCase() === checkCode
}

// 银行卡号验证（Luhn算法）
function validateBankCard(cardNumber: string): boolean {
  if (!/^\d{16,19}$/.test(cardNumber)) {
    return false
  }
  
  let sum = 0
  let isEven = false
  
  for (let i = cardNumber.length - 1; i >= 0; i--) {
    let digit = parseInt(cardNumber[i])
    
    if (isEven) {
      digit *= 2
      if (digit > 9) {
        digit -= 9
      }
    }
    
    sum += digit
    isEven = !isEven
  }
  
  return sum % 10 === 0
}

// 手机号验证
function validatePhone(phone: string): boolean {
  return /^1[3-9]\d{9}$/.test(phone)
}

export default function WithdrawalClient({
  data,
  teacherId
}: {
  data: WithdrawalData
  teacherId: string
}) {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<'apply' | 'history'>('apply')
  const [showSuccess, setShowSuccess] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  // 表单状态
  const [formData, setFormData] = useState({
    accountName: data.latestBankInfo?.accountName || data.teacher.name || '',
    bankName: data.latestBankInfo?.bankName || '',
    cardNumber: data.latestBankInfo?.cardNumber || '',
    phone: data.latestBankInfo?.phone || data.teacher.phone || '',
    idCard: data.latestBankInfo?.idCard || ''
  })
  
  // 表单验证错误
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({})
  
  const validateForm = () => {
    const errors: Record<string, string> = {}
    
    if (!formData.accountName.trim()) {
      errors.accountName = '请输入账户名称'
    }
    
    if (!formData.bankName.trim()) {
      errors.bankName = '请输入开户行名称'
    }
    
    if (!formData.cardNumber.trim()) {
      errors.cardNumber = '请输入银行卡号'
    } else if (!validateBankCard(formData.cardNumber)) {
      errors.cardNumber = '银行卡号格式不正确'
    }
    
    if (!formData.phone.trim()) {
      errors.phone = '请输入手机号'
    } else if (!validatePhone(formData.phone)) {
      errors.phone = '手机号格式不正确'
    }
    
    if (!formData.idCard.trim()) {
      errors.idCard = '请输入身份证号码'
    } else if (!validateIdCard(formData.idCard)) {
      errors.idCard = '身份证号码格式不正确'
    }
    
    setValidationErrors(errors)
    return Object.keys(errors).length === 0
  }
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!validateForm()) {
      return
    }
    
    if (data.earnings.availableBalance <= 0) {
      setError('可提现金额为0，无法提交申请')
      return
    }
    
    setLoading(true)
    setError(null)
    
    const result = await applyForWithdrawal(teacherId, {
      amount: data.earnings.availableBalance,
      accountName: formData.accountName,
      bankName: formData.bankName,
      cardNumber: formData.cardNumber,
      phone: formData.phone,
      idCard: formData.idCard
    })
    
    setLoading(false)
    
    if (result.success) {
      setShowSuccess(true)
    } else {
      const errorMessage = 'error' in result && result.error ? result.error : '提交失败，请重试'
      setError(errorMessage)
    }
  }
  
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PENDING':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">⏳ 已申请</span>
      case 'APPROVED':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-success-100 text-success-800">✅ 已成功</span>
      case 'REJECTED':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">❌ 已驳回</span>
      default:
        return null
    }
  }
  
  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white py-8 px-4">
      <div className="max-w-4xl mx-auto">
        {/* 顶部导航 */}
        <div className="mb-6">
          <button
            onClick={() => router.push('/referral/dashboard')}
            className="text-primary-600 hover:text-primary-700 font-medium inline-flex items-center"
          >
            ← 返回邀请看板
          </button>
        </div>
        
        {/* 页面标题 */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">提现申请</h1>
          <p className="text-gray-600">填写提现信息，我们将在3个工作日内完成转账</p>
        </div>
        
        {/* 收益概览 */}
        <div className="card mb-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">💰 收益概览</h3>
          {data.earnings.totalPending > 0 && (
            <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-blue-800 text-sm">
                💡 您有 <span className="font-bold">¥{data.earnings.totalPending}</span> 的提现申请正在审核中，该金额已从可提现余额中扣除。审核通过后将转账至您的账户，若被驳回则会自动恢复到可提现余额。
              </p>
            </div>
          )}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <div className="text-2xl font-bold text-primary-600">{data.earnings.validReferralsCount}</div>
              <div className="text-sm text-gray-600 mt-1">有效邀请数</div>
            </div>
            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <div className="text-2xl font-bold text-success-600">{data.earnings.totalEarnings}</div>
              <div className="text-sm text-gray-600 mt-1">总收益（元）</div>
            </div>
            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <div className="text-2xl font-bold text-blue-600">{data.earnings.totalWithdrawn}</div>
              <div className="text-sm text-gray-600 mt-1">已提现（元）</div>
            </div>
            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <div className="text-2xl font-bold text-orange-600">{data.earnings.totalPending}</div>
              <div className="text-sm text-gray-600 mt-1">待审核（元）</div>
            </div>
            <div className="text-center p-4 bg-amber-50 rounded-lg border-2 border-amber-200">
              <div className="text-2xl font-bold text-amber-600">{data.earnings.availableBalance}</div>
              <div className="text-sm text-gray-600 mt-1">可提现（元）</div>
            </div>
          </div>
        </div>
        
        {/* Tab 切换 */}
        <div className="card mb-6">
          <div className="flex border-b border-gray-200 mb-6">
            <button
              onClick={() => setActiveTab('apply')}
              className={`flex-1 py-3 px-4 text-center font-medium transition-colors ${
                activeTab === 'apply'
                  ? 'text-primary-600 border-b-2 border-primary-600'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              📝 申请提现
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`flex-1 py-3 px-4 text-center font-medium transition-colors ${
                activeTab === 'history'
                  ? 'text-primary-600 border-b-2 border-primary-600'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              📋 提现历史记录
            </button>
          </div>
          
          {/* 申请提现 Tab */}
          {activeTab === 'apply' && (
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">📝 提现信息</h3>
          
          {data.hasPendingWithdrawal && (
            <div className="mb-4 p-4 bg-amber-50 border border-amber-200 rounded-lg">
              <p className="text-amber-800 text-sm">
                ⚠️ 您有待处理的提现申请，请等待审核完成后再提交新申请
              </p>
            </div>
          )}
          
          {error && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-800 text-sm">{error}</p>
            </div>
          )}
          
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* 提现金额 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                提现金额（元）
              </label>
              <input
                type="text"
                value={data.earnings.availableBalance}
                readOnly
                className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-100 text-gray-700 font-medium"
              />
            </div>
            
            {/* 账户名称 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                账户名称（姓名）<span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.accountName}
                onChange={(e) => setFormData(prev => ({ ...prev, accountName: e.target.value }))}
                className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent ${
                  validationErrors.accountName ? 'border-red-300' : 'border-gray-300'
                }`}
                placeholder="请输入账户名称"
                disabled={data.hasPendingWithdrawal}
              />
              {validationErrors.accountName && (
                <p className="mt-1 text-sm text-red-600">{validationErrors.accountName}</p>
              )}
            </div>
            
            {/* 开户行名称 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                开户行名称<span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.bankName}
                onChange={(e) => setFormData(prev => ({ ...prev, bankName: e.target.value }))}
                className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent ${
                  validationErrors.bankName ? 'border-red-300' : 'border-gray-300'
                }`}
                placeholder="例如：中国工商银行北京分行"
                disabled={data.hasPendingWithdrawal}
              />
              {validationErrors.bankName && (
                <p className="mt-1 text-sm text-red-600">{validationErrors.bankName}</p>
              )}
            </div>
            
            {/* 卡号 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                银行卡号<span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.cardNumber}
                onChange={(e) => setFormData(prev => ({ ...prev, cardNumber: e.target.value.replace(/\s/g, '') }))}
                className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent ${
                  validationErrors.cardNumber ? 'border-red-300' : 'border-gray-300'
                }`}
                placeholder="请输入16-19位银行卡号"
                disabled={data.hasPendingWithdrawal}
              />
              {validationErrors.cardNumber && (
                <p className="mt-1 text-sm text-red-600">{validationErrors.cardNumber}</p>
              )}
            </div>
            
            {/* 手机号 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                手机号<span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.phone}
                onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent ${
                  validationErrors.phone ? 'border-red-300' : 'border-gray-300'
                }`}
                placeholder="请输入11位手机号"
                disabled={data.hasPendingWithdrawal}
              />
              {validationErrors.phone && (
                <p className="mt-1 text-sm text-red-600">{validationErrors.phone}</p>
              )}
            </div>
            
            {/* 身份证号码 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                身份证号码<span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.idCard}
                onChange={(e) => setFormData(prev => ({ ...prev, idCard: e.target.value.toUpperCase() }))}
                className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent ${
                  validationErrors.idCard ? 'border-red-300' : 'border-gray-300'
                }`}
                placeholder="请输入18位身份证号码"
                disabled={data.hasPendingWithdrawal}
              />
              {validationErrors.idCard && (
                <p className="mt-1 text-sm text-red-600">{validationErrors.idCard}</p>
              )}
            </div>
            
            {/* 提交按钮 */}
            <button
              type="submit"
              disabled={loading || data.earnings.availableBalance <= 0 || data.hasPendingWithdrawal}
              className="w-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-medium py-3 px-6 rounded-lg transition-all shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? '提交中...' : '提 交'}
            </button>
          </form>
            </div>
          )}
          
          {/* 提现历史记录 Tab */}
          {activeTab === 'history' && (
            <div>
              {data.withdrawals.length === 0 ? (
                <div className="text-center py-12">
                  <div className="text-6xl mb-4">📋</div>
                  <p className="text-gray-600">暂无提现记录</p>
                </div>
              ) : (
                <div>
                  {/* 桌面端表格 */}
                  <div className="hidden md:block overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-gray-200">
                          <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">提现时间</th>
                          <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">提现金额</th>
                          <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">账户名称</th>
                          <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">开户行</th>
                          <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">卡号</th>
                          <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">状态</th>
                          <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">备注</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.withdrawals.map((withdrawal) => (
                          <tr key={withdrawal.id} className="border-b border-gray-100 hover:bg-gray-50">
                            <td className="py-3 px-4 text-sm">
                              {new Date(withdrawal.createdAt).toLocaleDateString('zh-CN')}
                            </td>
                            <td className="py-3 px-4 text-sm font-medium text-amber-600">
                              ¥{withdrawal.amount}
                            </td>
                            <td className="py-3 px-4 text-sm">{withdrawal.accountName}</td>
                            <td className="py-3 px-4 text-sm">{withdrawal.bankName}</td>
                            <td className="py-3 px-4 text-sm font-mono">
                              {withdrawal.cardNumber.replace(/(\d{4})/g, '$1 ').trim()}
                            </td>
                            <td className="py-3 px-4 text-sm">{getStatusBadge(withdrawal.status)}</td>
                            <td className="py-3 px-4 text-sm text-gray-600">
                              {withdrawal.status === 'REJECTED' && withdrawal.rejectNote ? (
                                <span className="text-red-600">{withdrawal.rejectNote}</span>
                              ) : (
                                '-'
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  
                  {/* 移动端卡片 */}
                  <div className="md:hidden space-y-4">
                    {data.withdrawals.map((withdrawal) => (
                      <div key={withdrawal.id} className="p-4 border border-gray-200 rounded-lg">
                        <div className="flex justify-between items-start mb-3">
                          <div>
                            <div className="font-medium text-lg text-amber-600">¥{withdrawal.amount}</div>
                            <div className="text-xs text-gray-500">
                              {new Date(withdrawal.createdAt).toLocaleDateString('zh-CN')}
                            </div>
                          </div>
                          {getStatusBadge(withdrawal.status)}
                        </div>
                        <div className="space-y-1 text-sm text-gray-600">
                          <div>账户：{withdrawal.accountName}</div>
                          <div>开户行：{withdrawal.bankName}</div>
                          <div className="font-mono">卡号：{withdrawal.cardNumber.replace(/(\d{4})/g, '$1 ').trim()}</div>
                          {withdrawal.status === 'REJECTED' && withdrawal.rejectNote && (
                            <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-xs text-red-600">
                              <strong>驳回原因：</strong>{withdrawal.rejectNote}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
        
        {/* 成功提示模态框 */}
        {showSuccess && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg max-w-md w-full relative">
              {/* 关闭按钮 */}
              <button
                onClick={() => {
                  setShowSuccess(false)
                  router.refresh()
                }}
                className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
                aria-label="关闭"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
              
              <div className="p-6">
                <div className="text-center">
                  <div className="text-6xl mb-4">✅</div>
                  <h3 className="text-xl font-bold text-success-900 mb-2">提现申请已提交</h3>
                  <p className="text-success-800 mb-4">
                    已收到您的提现申请，预计 3 个工作日内完成转账。
                  </p>
                  <p className="text-sm text-success-700 mb-4">
                    如需核对信息或提现进度提醒，请添加杨老师微信（负责提现审核）
                  </p>
                  <div className="flex justify-center mb-4">
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <Image
                        src="/yang-qrcode-wechat.jpg"
                        alt="杨老师微信二维码"
                        width={200}
                        height={200}
                        className="rounded"
                      />
                      <p className="text-center text-sm text-gray-600 mt-2">扫码添加杨老师微信</p>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setShowSuccess(false)
                      setActiveTab('history')
                      router.refresh()
                    }}
                    className="w-full bg-primary-600 text-white py-2 px-4 rounded-lg hover:bg-primary-700 transition-colors font-medium"
                  >
                    查看提现记录
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
