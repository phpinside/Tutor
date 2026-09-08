'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { formatDateTime } from '@/lib/utils'
import { rejectCertificate } from '@/app/actions/certificate'
import { CERTIFICATE_TYPE_LABELS, type CertificateTypeKey } from '@/lib/certificate-template'
import StampPreviewModal, { preloadStampPreview } from './StampPreviewModal'

type Draft = {
  id: string
  teacherId: string
  teacherName: string
  teacherPhone: string
  certificateType: CertificateTypeKey
  templateName: string | null
  companyId: string | null
  stampUrl: string
  name: string | null
  gender: string | null
  startDate: string | null
  endDate: string | null
  companyName: string
  templateMode: 'SYSTEM' | 'CUSTOM'
  status: 'PROCESSING' | 'COMPLETED' | 'ISSUED' | 'REJECTED' | 'FAILED'
  errorMsg: string | null
  rejectionReason: string | null
  createdAt: string
  completedAt: string | null
  issuedAt: string | null
  rejectedAt: string | null
  downloadUrl: string | null
}

export default function InternshipCertificateManagementClient({
  initialDrafts,
}: {
  initialDrafts: Draft[]
}) {
  const router = useRouter()
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [actionError, setActionError] = useState('')
  const [previewDraft, setPreviewDraft] = useState<Draft | null>(null)
  const [rejectDraft, setRejectDraft] = useState<Draft | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [rejecting, setRejecting] = useState(false)

  const filtered = useMemo(() => {
    const keyword = searchTerm.trim().toLowerCase()
    return initialDrafts.filter((draft) => {
      if (statusFilter && draft.status !== statusFilter) return false
      if (typeFilter && draft.certificateType !== typeFilter) return false
      if (!keyword) return true
      return (
        draft.teacherName.toLowerCase().includes(keyword) ||
        (draft.name ?? '').toLowerCase().includes(keyword) ||
        (draft.teacherPhone ?? '').toLowerCase().includes(keyword)
      )
    })
  }, [initialDrafts, searchTerm, statusFilter, typeFilter])

  const handleReject = async () => {
    if (!rejectDraft) return
    setActionError('')
    setRejecting(true)
    try {
      const result = await rejectCertificate(rejectDraft.id, rejectReason)
      if (!result.success) {
        setActionError(result.error || '打回失败，请稍后重试')
        setRejecting(false)
        return
      }
      setRejectDraft(null)
      setRejectReason('')
      router.refresh()
    } catch {
      setActionError('网络异常，请稍后重试')
      setRejecting(false)
    }
  }

  const getStatusBadge = (draft: Draft) => {
    switch (draft.status) {
      case 'PROCESSING':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">处理中</span>
      case 'COMPLETED':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">待开具</span>
      case 'ISSUED':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">开具完毕</span>
      case 'REJECTED':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">已打回</span>
      case 'FAILED':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">生成失败</span>
    }
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">证明开具</h1>
        <p className="text-gray-600 mb-2">查看老师的实习证明 / 劳务完成确认单申请，拖动公章开具后下载正式 PDF</p>
      </div>

      {actionError && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{actionError}</div>
      )}

      <div className="bg-white rounded-lg shadow">
        <div className="p-4 border-b border-gray-200">
          <div className="flex flex-col md:flex-row gap-4">
            <input
              type="text"
              placeholder="搜索老师姓名或手机号..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
            />
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
            >
              <option value="">全部类型</option>
              {(Object.keys(CERTIFICATE_TYPE_LABELS) as CertificateTypeKey[]).map((type) => (
                <option key={type} value={type}>{CERTIFICATE_TYPE_LABELS[type]}</option>
              ))}
            </select>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
            >
              <option value="">全部状态</option>
              <option value="PROCESSING">处理中</option>
              <option value="COMPLETED">待开具</option>
              <option value="ISSUED">开具完毕</option>
              <option value="REJECTED">已打回</option>
              <option value="FAILED">生成失败</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          {filtered.length === 0 ? (
            <div className="text-center py-12 text-gray-500">暂无证明申请</div>
          ) : (
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">老师</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">类型 / 模板</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">申请信息</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">起止日期</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">状态</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">申请时间</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">操作</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((draft) => (
                  <tr key={draft.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-3 px-4 text-sm">
                      <div className="font-medium">{draft.teacherName}</div>
                      <div className="text-xs text-gray-500">{draft.teacherPhone}</div>
                    </td>
                    <td className="py-3 px-4 text-sm">
                      <div>{CERTIFICATE_TYPE_LABELS[draft.certificateType] ?? '证明申请'}</div>
                      <div className="text-xs text-gray-500">
                        {draft.templateMode === 'SYSTEM' ? draft.templateName ?? '系统模板' : '自定义上传'}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-sm">
                      {draft.templateMode === 'SYSTEM' && draft.name ? (
                        <>
                          <div>{draft.name}{draft.gender ? `（${draft.gender}）` : ''}</div>
                          <div className="text-xs text-gray-500">{draft.companyName}</div>
                        </>
                      ) : (
                        <span className="text-gray-400 text-xs">用户上传 PDF</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-600">
                      {draft.startDate && draft.endDate ? `${draft.startDate} ~ ${draft.endDate}` : '-'}
                    </td>
                    <td className="py-3 px-4 text-sm">
                      {getStatusBadge(draft)}
                      {draft.status === 'FAILED' && draft.errorMsg && (
                        <div className="text-xs text-red-600 mt-1 max-w-52">{draft.errorMsg}</div>
                      )}
                      {draft.status === 'REJECTED' && draft.rejectionReason && (
                        <div className="text-xs text-red-600 mt-1 max-w-52">{draft.rejectionReason}</div>
                      )}
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-600">{formatDateTime(draft.createdAt)}</td>
                    <td className="py-3 px-4 text-sm whitespace-nowrap">
                      {draft.status === 'COMPLETED' && (
                        <>
                          <button
                            type="button"
                            onClick={() => setPreviewDraft(draft)}
                            onPointerEnter={() => preloadStampPreview(draft.id, draft.completedAt)}
                            onFocus={() => preloadStampPreview(draft.id, draft.completedAt)}
                            className="text-primary-600 hover:text-primary-700 font-medium"
                          >
                            开具证明
                          </button>
                          <button
                            type="button"
                            onClick={() => { setRejectDraft(draft); setRejectReason('') }}
                            className="ml-3 text-red-600 hover:text-red-700 font-medium"
                          >
                            打回
                          </button>
                        </>
                      )}
                      {draft.downloadUrl && (
                        <a href={draft.downloadUrl} download className="text-primary-600 hover:text-primary-700 font-medium ml-3">
                          下载 PDF
                        </a>
                      )}
                      {draft.status === 'PROCESSING' && <span className="text-gray-400">-</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {previewDraft && (
        <StampPreviewModal
          draftId={previewDraft.id}
          previewVersion={previewDraft.completedAt}
          title={`开具${CERTIFICATE_TYPE_LABELS[previewDraft.certificateType] ?? '证明'} · ${previewDraft.name ?? previewDraft.teacherName}（${previewDraft.teacherName}）`}
          stampUrl={previewDraft.stampUrl}
          onClose={() => setPreviewDraft(null)}
          onIssued={() => {
            setPreviewDraft(null)
            router.refresh()
          }}
        />
      )}

      {rejectDraft && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200">
              <h2 className="text-base font-semibold text-gray-900">打回申请</h2>
              <button type="button" onClick={() => setRejectDraft(null)} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
            </div>
            <div className="p-5">
              <label className="mb-1 block text-sm font-medium text-gray-700">打回原因（用户可见）</label>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                rows={4}
                placeholder="请说明当前存在的问题，便于用户修改后重新提交"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <div className="flex items-center justify-end gap-3 px-5 py-3 border-t border-gray-200">
              <button type="button" onClick={() => setRejectDraft(null)} className="px-4 py-2 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50">取消</button>
              <button type="button" onClick={handleReject} disabled={rejecting} className="px-4 py-2 rounded-lg bg-red-600 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50">{rejecting ? '打回中…' : '确认打回'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
