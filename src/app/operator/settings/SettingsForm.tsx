'use client'

import { useState, useRef } from 'react'
import { updateOperatorProfile } from '@/app/actions/operatorActions'

type Profile = {
  id: string
  name: string
  phone: string
  wechatQrCode: string | null
  remarks: string | null
}

export default function SettingsForm({
  profile,
  operatorId,
  initialDisplayUrl,
}: {
  profile: Profile
  operatorId: string
  initialDisplayUrl?: string
}) {
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [name, setName] = useState(profile.name)
  // wechatQrCode 存储未签名 URL，用于写入数据库
  const [wechatQrCode, setWechatQrCode] = useState(profile.wechatQrCode || '')
  // displayUrl 存储签名 URL，用于前端 <img> 预览
  const [displayUrl, setDisplayUrl] = useState(initialDisplayUrl || '')
  const [remarks, setRemarks] = useState(profile.remarks || '')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [uploading, setUploading] = useState(false)
  const [uploadMsg, setUploadMsg] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  async function handleQrFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    setUploadMsg('')

    const fd = new FormData()
    fd.append('file', file)

    try {
      const res = await fetch('/api/upload/operator-qrcode', { method: 'POST', body: fd })
      const data = await res.json()
      if (res.ok && data.url) {
        setWechatQrCode(data.url)           // 未签名 URL，保存到数据库
        setDisplayUrl(data.signedUrl || data.url) // 签名 URL 用于预览
        setUploadMsg('✅ 图片已上传，点击下方"保存设置"即可生效')
      } else {
        setUploadMsg(`❌ ${data.error || '上传失败'}`)
      }
    } catch {
      setUploadMsg('❌ 上传失败，请重试')
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setMessage('')

    if (newPassword && newPassword !== confirmPassword) {
      setMessage('❌ 两次密码输入不一致')
      return
    }
    if (newPassword && newPassword.length < 6) {
      setMessage('❌ 密码至少 6 位')
      return
    }

    setLoading(true)
    const result = await updateOperatorProfile(operatorId, {
      name: name.trim(),
      wechatQrCode: wechatQrCode.trim() || undefined,
      remarks: remarks.trim() || undefined,
      ...(newPassword ? { password: newPassword } : {}),
    })

    if (result.success) {
      setMessage('✅ 保存成功')
      setNewPassword('')
      setConfirmPassword('')
    } else {
      setMessage('❌ 保存失败，请重试')
    }
    setLoading(false)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {message && (
        <div
          className={`p-3 rounded-lg text-sm ${
            message.startsWith('✅')
              ? 'bg-green-50 border border-green-200 text-green-700'
              : 'bg-red-50 border border-red-200 text-red-700'
          }`}
        >
          {message}
        </div>
      )}

      <div className="card space-y-4">
        <h2 className="font-semibold text-gray-800">基本信息</h2>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">姓名</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="input w-full"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">手机号</label>
          <input
            type="text"
            value={profile.phone}
            disabled
            className="input w-full bg-gray-50 text-gray-400 cursor-not-allowed"
          />
          <p className="text-xs text-gray-400 mt-1">手机号不可修改，如需更改请联系管理员</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">微信二维码</label>

          {/* 预览区 */}
          <div className="flex items-start gap-4 mb-3">
            <div className="w-28 h-28 flex-shrink-0 border-2 border-dashed border-gray-200 rounded-xl overflow-hidden bg-gray-50 flex items-center justify-center">
              {displayUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={displayUrl}
                  alt="微信二维码预览"
                  className="w-full h-full object-contain p-1"
                  onError={(e) => {
                    ;(e.target as HTMLImageElement).style.display = 'none'
                  }}
                />
              ) : (
                <span className="text-xs text-gray-400 text-center px-2">暂无图片</span>
              )}
            </div>

            <div className="flex-1">
              <label
                htmlFor="qr-upload"
                className={`flex items-center justify-center gap-2 w-full px-4 py-3 border-2 border-dashed rounded-xl cursor-pointer transition-colors text-sm font-medium
                  ${uploading
                    ? 'border-gray-200 bg-gray-50 text-gray-400 cursor-not-allowed'
                    : 'border-primary-300 bg-primary-50 text-primary-700 hover:border-primary-400 hover:bg-primary-100'
                  }`}
              >
                <input
                  id="qr-upload"
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/jpg,image/webp"
                  onChange={handleQrFileChange}
                  disabled={uploading}
                  className="hidden"
                />
                {uploading ? (
                  <>
                    <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    上传中…
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                    {displayUrl || wechatQrCode ? '重新上传' : '点击上传图片'}
                  </>
                )}
              </label>
              <p className="text-xs text-gray-400 mt-1.5">支持 PNG / JPG / WEBP，最大 5MB</p>
            </div>
          </div>

          {uploadMsg && (
            <p className={`text-xs mt-1 ${uploadMsg.startsWith('✅') ? 'text-green-600' : 'text-red-500'}`}>
              {uploadMsg}
            </p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">备注</label>
          <textarea
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
            rows={3}
            className="input w-full resize-none"
            placeholder="个人备注信息"
          />
        </div>
      </div>

      <div className="card space-y-4">
        <h2 className="font-semibold text-gray-800">修改密码</h2>
        <p className="text-sm text-gray-500">不修改密码请留空</p>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">新密码</label>
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className="input w-full"
            placeholder="至少 6 位"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">确认新密码</label>
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="input w-full"
            placeholder="再次输入新密码"
          />
        </div>
      </div>

      <button type="submit" disabled={loading} className="btn-primary w-full">
        {loading ? '保存中...' : '保存设置'}
      </button>
    </form>
  )
}
