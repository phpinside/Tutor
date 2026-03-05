'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { setTeacherInviter, searchTeachersForInviter } from '@/app/actions/teacher'

interface InviterInfo {
  id: string
  name: string | null
  phone: string | null
}

interface SetInviterModalProps {
  teacherId: string
  currentInviter: InviterInfo | null
}

interface TeacherOption {
  id: string
  name: string | null
  phone: string | null
}

export default function SetInviterModal({ teacherId, currentInviter }: SetInviterModalProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<TeacherOption[]>([])
  const [selected, setSelected] = useState<TeacherOption | null>(null)
  const [isSearching, setIsSearching] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [showDropdown, setShowDropdown] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const handleSearch = useCallback(
    (value: string) => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
      if (!value.trim()) {
        setResults([])
        setShowDropdown(false)
        return
      }
      debounceRef.current = setTimeout(async () => {
        setIsSearching(true)
        const res = await searchTeachersForInviter(value, teacherId)
        setIsSearching(false)
        if (res.success) {
          setResults(res.teachers)
          setShowDropdown(true)
        }
      }, 300)
    },
    [teacherId]
  )

  useEffect(() => {
    handleSearch(query)
  }, [query, handleSearch])

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleSelect = (teacher: TeacherOption) => {
    setSelected(teacher)
    setQuery(teacher.name || teacher.id)
    setShowDropdown(false)
  }

  const handleSubmit = async () => {
    if (!selected) {
      alert('请先搜索并选择邀请人')
      return
    }

    if (currentInviter && !confirm(`该教师已有邀请人（${currentInviter.name || currentInviter.id}），确定要覆盖邀请人吗？`)) {
      return
    }

    setIsLoading(true)
    const result = await setTeacherInviter(teacherId, selected.id)
    setIsLoading(false)

    if (result.success) {
      alert(`邀请人已设置为：${result.inviterName}`)
      handleClose()
      router.refresh()
    } else {
      alert('操作失败：' + result.error)
    }
  }

  const handleClose = () => {
    setOpen(false)
    setQuery('')
    setResults([])
    setSelected(null)
    setShowDropdown(false)
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors"
      >
        设置邀请人
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* 遮罩 */}
          <div
            className="absolute inset-0 bg-black/40"
            onClick={handleClose}
          />

          {/* 弹窗 */}
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md mx-4 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">设置邀请人</h2>

            {/* 当前邀请人信息 */}
            {currentInviter ? (
              <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm">
                <p className="text-amber-700 font-medium mb-1">当前邀请人</p>
                <p className="text-amber-900">
                  {currentInviter.name || '未命名'} · {currentInviter.id}
                </p>
                {currentInviter.phone && (
                  <p className="text-amber-700">{currentInviter.phone}</p>
                )}
              </div>
            ) : (
              <div className="mb-4 p-3 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-500">
                暂无邀请人
              </div>
            )}

            {/* 搜索框 */}
            <div className="mb-6" ref={dropdownRef}>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                搜索邀请人
                <span className="ml-1 text-gray-400 font-normal">（支持按姓名或 ID 检索）</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={query}
                  onChange={e => {
                    setQuery(e.target.value)
                    setSelected(null)
                  }}
                  placeholder="输入姓名或 ID 搜索..."
                  className="w-full px-3 py-2 pr-8 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  autoFocus
                  autoComplete="off"
                />
                {isSearching && (
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400">
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>
                  </span>
                )}

                {/* 下拉结果 */}
                {showDropdown && (
                  <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                    {results.length === 0 ? (
                      <div className="px-3 py-3 text-sm text-gray-500 text-center">未找到匹配的教师</div>
                    ) : (
                      results.map(teacher => (
                        <button
                          key={teacher.id}
                          type="button"
                          onClick={() => handleSelect(teacher)}
                          className="w-full text-left px-3 py-2 text-sm hover:bg-indigo-50 transition-colors border-b border-gray-100 last:border-b-0"
                        >
                          <span className="font-medium text-gray-900">{teacher.name || '未命名'}</span>
                          <span className="ml-2 text-gray-500 text-xs">{teacher.id}</span>
                          {teacher.phone && (
                            <span className="ml-2 text-gray-400 text-xs">{teacher.phone}</span>
                          )}
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>

              {/* 已选中提示 */}
              {selected && (
                <div className="mt-2 p-2 bg-indigo-50 border border-indigo-200 rounded-lg text-sm flex items-center gap-2">
                  <svg className="w-4 h-4 text-indigo-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-indigo-700">
                    已选择：<strong>{selected.name || '未命名'}</strong>
                    <span className="ml-1 text-indigo-500 font-normal text-xs">({selected.id})</span>
                  </span>
                </div>
              )}
            </div>

            {/* 操作按钮 */}
            <div className="flex gap-3 justify-end">
              <button
                onClick={handleClose}
                disabled={isLoading}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50"
              >
                取消
              </button>
              <button
                onClick={handleSubmit}
                disabled={isLoading || !selected}
                className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50"
              >
                {isLoading ? '设置中...' : '确定'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
