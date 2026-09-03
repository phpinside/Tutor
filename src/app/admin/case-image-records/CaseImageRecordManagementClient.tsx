'use client'

import { useMemo, useState } from 'react'
import { formatDateTime } from '@/lib/utils'
import type { CaseImageRecordDTO } from '@/lib/case-image-records'

export default function CaseImageRecordManagementClient({
  initialRecords,
}: {
  initialRecords: CaseImageRecordDTO[]
}) {
  const [searchTerm, setSearchTerm] = useState('')
  const [subjectFilter, setSubjectFilter] = useState('')
  const [previewRecord, setPreviewRecord] = useState<CaseImageRecordDTO | null>(null)

  const filtered = useMemo(() => {
    const keyword = searchTerm.trim().toLowerCase()
    return initialRecords.filter((record) => {
      if (subjectFilter && record.scoreTitle !== subjectFilter) return false
      if (!keyword) return true
      return (
        record.studentName.toLowerCase().includes(keyword) ||
        record.teamName.toLowerCase().includes(keyword) ||
        record.coachSignature.toLowerCase().includes(keyword) ||
        (record.teacherName ?? '').toLowerCase().includes(keyword) ||
        (record.teacherPhone ?? '').includes(keyword)
      )
    })
  }, [initialRecords, searchTerm, subjectFilter])

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">案例生成记录</h1>
        <p className="text-gray-600 mb-2">查看所有老师生成的案例喜报图，共 {initialRecords.length} 条</p>
      </div>

      <div className="bg-white rounded-lg shadow">
        <div className="p-4 border-b border-gray-200">
          <div className="flex flex-col md:flex-row gap-4">
            <input
              type="text"
              placeholder="搜索学生姓名 / 团队名 / 教练 / 老师姓名或手机号..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
            />
            <select
              value={subjectFilter}
              onChange={(e) => setSubjectFilter(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
            >
              <option value="">全部科目</option>
              <option value="数学喜报">数学喜报</option>
              <option value="物理喜报">物理喜报</option>
              <option value="化学喜报">化学喜报</option>
            </select>
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="px-4 py-16 text-center text-sm text-gray-400">
            {initialRecords.length === 0 ? '暂无生成记录' : '没有符合条件的记录'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">生成时间</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">生成人</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">学生地区</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">学生姓名</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">年级</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">提分科目</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">学习时长</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">提分分数</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">团队名</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">教练署名</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filtered.map((record) => (
                  <tr key={record.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap">{formatDateTime(record.createdAt)}</td>
                    <td className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap">
                      <div>{record.teacherName || '未填写'}</div>
                      <div className="text-xs text-gray-400">{record.teacherPhone || '-'}</div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap">{record.studentRegion || '-'}</td>
                    <td className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap">{record.studentName || '-'}</td>
                    <td className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap">{record.studentGrade || '-'}</td>
                    <td className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap">{record.scoreTitle || '-'}</td>
                    <td className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap">{record.studyDuration || '-'}</td>
                    <td className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap">{record.scoreIncrease || '-'}</td>
                    <td className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap">{record.teamName || '-'}</td>
                    <td className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap">{record.coachSignature || '-'}</td>
                    <td className="px-4 py-3 text-sm whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => setPreviewRecord(record)}
                        className="text-primary-600 hover:text-primary-800 font-medium mr-3"
                      >
                        查看大图
                      </button>
                      <a
                        href={record.imageDownloadUrl}
                        className="text-green-600 hover:text-green-800 font-medium"
                      >
                        下载
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {previewRecord && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={() => setPreviewRecord(null)}
        >
          <div
            className="relative max-h-full w-auto max-w-3xl overflow-auto rounded-xl bg-white p-4"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-3 text-sm text-gray-600">
              {formatDateTime(previewRecord.createdAt)} · {previewRecord.teacherName || '未填写'} ·{' '}
              {previewRecord.studentRegion}
              {previewRecord.studentGrade}
              {previewRecord.studentName} · {previewRecord.scoreTitle}
            </div>
            <img
              src={previewRecord.imageUrl}
              alt={`案例图 - ${previewRecord.studentName}`}
              className="mx-auto max-h-[72vh] w-auto rounded-lg"
            />
            <div className="mt-4 flex justify-center gap-2">
              <a
                href={previewRecord.imageDownloadUrl}
                className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-green-700"
              >
                下载案例图
              </a>
              <button
                type="button"
                onClick={() => setPreviewRecord(null)}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
              >
                关闭
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
