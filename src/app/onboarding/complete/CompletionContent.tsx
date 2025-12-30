'use client'

import { useState } from 'react'
import Link from 'next/link'

interface CompletionContentProps {
  teacherName: string | null
  teacherId: string
  totalTasks: number
}

export default function CompletionContent({ teacherName, teacherId, totalTasks }: CompletionContentProps) {
  const [showQRCode, setShowQRCode] = useState(false)
  const [showTeacherWechat, setShowTeacherWechat] = useState(false)
  const [copied, setCopied] = useState(false)
  
  const handleCopyId = () => {
    navigator.clipboard.writeText(teacherId)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  
  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="max-w-2xl w-full animate-fade-in">
        {/* 恭喜文案 */}
        <div className="card">
          <div className="flex items-center justify-center gap-6 mb-8">
            <div className="inline-block animate-bounce text-7xl">
              🎉
            </div>
            <div className="text-left">
              <h1 className="text-3xl font-bold text-gray-900 mb-2">
                恭喜你完成所有新手任务!
              </h1>
              <p className="text-lg text-gray-600">
                你已经成功解锁{' '}
                <span className="text-primary-600 font-semibold">数学伴学老师</span>
                {' '}身份
              </p>
            </div>
          </div>
          
          {/* 身份卡片 */}
          <div className="bg-gradient-to-br from-primary-500 to-indigo-600 rounded-xl p-8 text-white mb-8 shadow-lg">
            <div className="flex items-center justify-center gap-4 mb-4">
              <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center text-3xl">
                🎓
              </div>
              <div className="text-left">
                <p className="text-sm opacity-90">认证伴学老师</p>
                <p className="text-2xl font-bold">{teacherName || '新老师'}</p>
              </div>
            </div>
            <div className="flex justify-around text-center mt-6 pt-6 border-t border-white/20">
              <div>
                <p className="text-3xl font-bold">✓</p>
                <p className="text-xs opacity-90 mt-1">已完成培训</p>
              </div>
              <div>
                <p className="text-3xl font-bold">{totalTasks}</p>
                <p className="text-xs opacity-90 mt-1">完成任务</p>
              </div>
              <div>
                <p className="text-3xl font-bold">🚀</p>
                <p className="text-xs opacity-90 mt-1">准备就绪</p>
              </div>
            </div>
          </div>
          
          {/* 老师ID高亮提醒 */}
          <div className="bg-amber-50 border-2 border-amber-400 rounded-xl p-6 mb-8 shadow-md">
            <div className="flex items-start gap-3 mb-4">
              <div className="text-2xl">⚠️</div>
              <div className="flex-1">
                <h3 className="text-lg font-bold text-amber-900 mb-1">请务必保存好您的老师ID</h3>
                <p className="text-sm text-amber-800">此ID是您的唯一标识，请妥善保管，用于后续接单和身份验证</p>
              </div>
            </div>
            <div className="bg-white rounded-lg p-4 border-2 border-amber-300">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <p className="text-xs text-gray-600 mb-1">您的老师ID</p>
                  <p className="text-2xl font-bold text-gray-900 font-mono tracking-wider">{teacherId}</p>
                </div>
                <button
                  onClick={handleCopyId}
                  className="ml-4 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg transition-colors flex items-center gap-2 font-medium"
                >
                  {copied ? (
                    <>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      已复制
                    </>
                  ) : (
                    <>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                      复制ID
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
          
          {/* 下一步 */}
          <div className="space-y-4">
            <h2 className="text-xl font-semibold text-gray-900">
              接下来你可以:
            </h2>
            
            <div className="grid gap-4 md:grid-cols-3">
              {/* 添加宋老师微信 */}
              <button
                onClick={() => setShowTeacherWechat(true)}
                className="card-hover text-left p-6 border-2 border-primary-500 cursor-pointer bg-white hover:bg-gray-50 transition-all"
              >
                <div className="text-3xl mb-3">💬</div>
                <h3 className="font-semibold text-gray-900 mb-2">1、添加数学主管宋老师微信</h3>
                <p className="text-sm text-gray-600">
                  发送自己的老师ID，开启接单
                </p>
                <div className="mt-3 text-primary-600 text-sm font-medium">
                  点击查看微信号 →
                </div>
              </button>
              
              {/* 扫码加入新手群 */}
              <button
                onClick={() => setShowQRCode(true)}
                className="card-hover text-left p-6 border-2 border-gray-200 hover:border-primary-300 cursor-pointer bg-white hover:bg-gray-50 transition-all"
              >
                <div className="text-3xl mb-3">📱</div>
                <h3 className="font-semibold text-gray-900 mb-2">2、扫码加入伴学老师群</h3>
                <p className="text-sm text-gray-600">
                  加入伴学老师新手群
                </p>
                <div className="mt-3 text-primary-600 text-sm font-medium">
                  点击查看二维码 →
                </div>
              </button>
              
              {/* 观看经验总结文档 */}
              <a
                href="https://fn73lnaiyt.feishu.cn/wiki/CgXJwwewZin7oDkevbfc2HsinVW"
                target="_blank"
                rel="noopener noreferrer"
                className="card-hover text-left p-6 border-2 border-gray-200 hover:border-primary-300 block bg-white transition-all"
              >
                <div className="text-3xl mb-3">📖</div>
                <h3 className="font-semibold text-gray-900 mb-2">3、观看伴学经验总结</h3>
                <p className="text-sm text-gray-600">
                  数学在线伴学经验总结在线文档
                </p>
                <div className="mt-3 text-primary-600 text-sm font-medium flex items-center gap-1">
                  立即查看
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </div>
              </a>
            </div>
          </div>
        </div>
        
        {/* 欢迎语 */}
        <div className="mt-8 text-center">
          <p className="text-gray-600">
            期待在伴学的旅程中,看到你的精彩表现 🌟
          </p>
        </div>
      </div>
      
      {/* 二维码弹窗 */}
      {showQRCode && (
        <div 
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setShowQRCode(false)}
        >
          <div 
            className="bg-white rounded-xl p-6 max-w-md w-full animate-fade-in"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900">扫码加入伴学老师群</h3>
              <button
                onClick={() => setShowQRCode(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="text-center">
              {/* 二维码占位区域 */}
              <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-lg p-8 mb-4">
                <div className="w-64 h-64 mx-auto bg-white rounded-lg shadow-lg flex items-center justify-center border-2 border-gray-200">
                  {/* 这里应该放置实际的二维码图片 */}
                  <div className="text-center p-6">
                      <img src="/qrcode-wechat-group.jpg" alt="微信群二维码" className="w-full h-full" />
                  </div>
                </div>
              </div>
              
              <p className="text-sm text-gray-700 mb-2 font-medium">
                使用微信扫描二维码
              </p>
            
            </div>
          </div>
        </div>
      )}
      
      {/* 宋老师微信弹窗 */}
      {showTeacherWechat && (
        <div 
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setShowTeacherWechat(false)}
        >
          <div 
            className="bg-white rounded-xl p-6 max-w-md w-full animate-fade-in"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900">联系宋老师</h3>
              <button
                onClick={() => setShowTeacherWechat(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="text-center">
              {/* 二维码区域 */}
              <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-6 mb-4">
                <div className="w-64 h-64 mx-auto bg-white rounded-lg shadow-lg flex items-center justify-center border-2 border-green-200 mb-4">
                  <img src="/qrcode-wechat.jpg" alt="宋老师微信二维码" className="w-full h-full object-cover rounded-lg" />
                </div>
                
                {/* 微信号显示 */}
                <div className="bg-white rounded-lg shadow-md p-4 border-2 border-green-200">
                  <div className="flex items-center justify-center gap-2 mb-2">
                    <div className="text-2xl">💬</div>
                    <p className="text-gray-700 font-medium">微信号</p>
                  </div>
                  <p className="text-xl font-bold text-gray-900 mb-2">zyx853211</p>
                  <p className="text-xs text-gray-600">可扫描上方二维码或复制微信号添加</p>
                </div>
              </div>
              
              {/* 提醒发送老师ID */}
              <div className="bg-amber-50 border border-amber-300 rounded-lg p-4 text-left">
                <div className="flex items-start gap-2">
                  <div className="text-xl">💡</div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-amber-900 mb-1">温馨提示</p>
                    <p className="text-xs text-amber-800">
                      添加宋老师微信后，请发送您的老师ID（{teacherId}）以开启接单
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

