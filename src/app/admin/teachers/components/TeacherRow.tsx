'use client'

import { useState } from 'react'
import Link from 'next/link'
import { getTeacherStatusText } from '@/lib/utils'
import ReferralList from './ReferralList'

type Teacher = {
  id: string
  name: string | null
  school: string | null
  status: string
  currentTaskIndex: number
  createdAt: Date
  sentReferrals: any[]
  totalInvites: number
  validInvites: number
  pendingRewards: number
}

type TeacherRowProps = {
  teacher: Teacher
}

export default function TeacherRow({ teacher }: TeacherRowProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  return (
    <>
      <tr className="hover:bg-gray-50 transition-colors">
        <td className="px-6 py-4 whitespace-nowrap">
          {teacher.sentReferrals.length > 0 && (
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="text-gray-500 hover:text-gray-700 transition-transform"
              style={{ transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)' }}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          )}
        </td>
        <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-500">
          {teacher.id.substring(0, 8)}...
        </td>
        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
          {teacher.name || <span className="text-gray-400">未填写</span>}
        </td>
        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
          {teacher.school || <span className="text-gray-400">-</span>}
        </td>
        <td className="px-6 py-4 whitespace-nowrap">
          <span className={`badge ${
            teacher.status === 'UNLOCKED' ? 'badge-success' :
            teacher.status === 'COMPLETED' ? 'badge-primary' :
            'badge-gray'
          }`}>
            {getTeacherStatusText(teacher.status)}
          </span>
        </td>
        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
          {teacher.currentTaskIndex} / 6
        </td>
        <td className="px-6 py-4 whitespace-nowrap text-sm">
          {teacher.totalInvites > 0 ? (
            <div>
              <div className="text-gray-900 font-medium">
                邀请 {teacher.totalInvites} 人
              </div>
              <div className="text-xs text-gray-500">
                有效 {teacher.validInvites} 人
                {teacher.pendingRewards > 0 && (
                  <span className="text-warning-600"> · 待发 {teacher.pendingRewards}</span>
                )}
              </div>
            </div>
          ) : (
            <span className="text-gray-400">暂无邀请</span>
          )}
        </td>
        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
          {new Date(teacher.createdAt).toLocaleDateString('zh-CN')}
        </td>
        <td className="px-6 py-4 whitespace-nowrap text-sm">
          <Link
            href={`/admin/teachers/${teacher.id}`}
            className="text-primary-600 hover:text-primary-900 font-medium transition-colors"
          >
            查看详情
          </Link>
        </td>
      </tr>
      {isExpanded && teacher.sentReferrals.length > 0 && (
        <tr>
          <td colSpan={9} className="px-6 py-4 bg-gray-50">
            <ReferralList 
              referrals={teacher.sentReferrals} 
              teacherName={teacher.name}
            />
          </td>
        </tr>
      )}
    </>
  )
}
