'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { addTeacherRemark } from '@/app/actions/operatorActions'
import { formatDateTime } from '@/lib/utils'

type Remark = {
  id: string
  remarkBy: string
  content: string
  createdAt: Date
}

export default function TeacherRemarkSection({
  teacherId,
  viewerId,
  viewerName,
  initialRemarks,
}: {
  teacherId: string
  viewerId: string | null
  viewerName: string
  initialRemarks: Remark[]
}) {
  const router = useRouter()
  const [content, setContent] = useState('')
  const [loading, setLoading] = useState(false)
  const [remarks, setRemarks] = useState(initialRemarks)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!content.trim()) return
    setLoading(true)

    const result = await addTeacherRemark({
      teacherId,
      operatorId: viewerId ?? null,
      remarkBy: viewerName,
      content: content.trim(),
    })

    if (result.success) {
      setRemarks([
        {
          id: result.remark.id,
          remarkBy: result.remark.remarkBy,
          content: result.remark.content,
          createdAt: result.remark.createdAt,
        },
        ...remarks,
      ])
      setContent('')
      router.refresh()
    }
    setLoading(false)
  }

  return (
    <div className="card mt-8">
      <h2 className="text-xl font-bold text-gray-900 mb-4">备注日志</h2>

      <form onSubmit={handleSubmit} className="mb-6">
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={3}
          className="input w-full resize-none mb-3"
          placeholder="添加备注内容..."
        />
        <button
          type="submit"
          disabled={loading || !content.trim()}
          className="btn-primary"
        >
          {loading ? '提交中...' : '添加备注'}
        </button>
      </form>

      {remarks.length === 0 ? (
        <div className="text-center py-8 text-gray-400">
          <div className="text-3xl mb-2">📝</div>
          <p className="text-sm">暂无备注记录</p>
        </div>
      ) : (
        <div className="space-y-3">
          {remarks.map((remark) => (
            <div key={remark.id} className="p-4 bg-gray-50 rounded-lg border border-gray-100">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-800">{remark.remarkBy}</span>
                <span className="text-xs text-gray-400">{formatDateTime(remark.createdAt)}</span>
              </div>
              <p className="text-sm text-gray-700 whitespace-pre-wrap">{remark.content}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
