'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { searchOperators, setInviterDefaultFollowUpPerson } from '@/app/actions/operatorActions'

interface OperatorOption {
  id: string
  name: string
  phone: string
}

interface SetInviteeDefaultFollowerModalProps {
  teacherId: string
  currentDefaultFollowUp: { id: string; name: string; phone: string } | null
}

export default function SetInviteeDefaultFollowerModal({
  teacherId,
  currentDefaultFollowUp,
}: SetInviteeDefaultFollowerModalProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<OperatorOption[]>([])
  const [selected, setSelected] = useState<OperatorOption | null>(null)
  const [isSearching, setIsSearching] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [showDropdown, setShowDropdown] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const handleSearch = useCallback((value: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (!value.trim()) {
      setResults([])
      setShowDropdown(false)
      return
    }
    debounceRef.current = setTimeout(async () => {
      setIsSearching(true)
      const res = await searchOperators(value)
      setIsSearching(false)
      if (res.success) {
        setResults(res.operators)
        setShowDropdown(true)
      }
    }, 300)
  }, [])

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

  const handleSelect = (operator: OperatorOption) => {
    setSelected(operator)
    setQuery(operator.name)
    setShowDropdown(false)
  }

  const handleSubmit = async () => {
    if (!selected) {
      alert('请先搜索并选择跟进人')
      return
    }

    setIsLoading(true)
    const result = await setInviterDefaultFollowUpPerson(teacherId, selected.id)
    setIsLoading(false)

    if (result.success) {
      alert(`已将默认跟进人设置为：${selected.name}`)
      handleClose()
      router.refresh()
    } else {
      alert('操作失败，请重试')
    }
  }

  const handleClear = async () => {
    if (!confirm(`确定要清除默认跟进人设置吗？`)) return

    setIsLoading(true)
    const result = await setInviterDefaultFollowUpPerson(teacherId, null)
    setIsLoading(false)

    if (result.success) {
      alert('已清除默认跟进人设置')
      handleClose()
      router.refresh()
    } else {
      alert('操作失败，请重试')
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
        className="px-4 py-2 text-sm font-medium text-white bg-teal-600 rounded-lg hover:bg-teal-700 transition-colors"
      >
        设置默认跟进人
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={handleClose} />

          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md mx-4 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">设置被邀请人默认跟进人</h2>

            <div className="mb-4 p-3 bg-teal-50 border border-teal-200 rounded-lg text-sm text-teal-800">
              设置后，该邀请人未来带来的新注册老师将自动归属至该跟进人（不影响已有数据）。
            </div>

            {currentDefaultFollowUp ? (
              <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm">
                <p className="text-amber-700 font-medium mb-1">当前默认跟进人</p>
                <p className="text-amber-900">
                  {currentDefaultFollowUp.name}
                  {currentDefaultFollowUp.phone && (
                    <span className="ml-2 text-amber-600 text-xs">{currentDefaultFollowUp.phone}</span>
                  )}
                </p>
              </div>
            ) : (
              <div className="mb-4 p-3 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-500">
                当前未配置默认跟进人
              </div>
            )}

            <div className="mb-6" ref={dropdownRef}>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                搜索跟进人
                <span className="ml-1 text-gray-400 font-normal">（支持按姓名或手机号检索）</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value)
                    setSelected(null)
                  }}
                  placeholder="输入姓名或手机号搜索..."
                  className="w-full px-3 py-2 pr-8 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
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

                {showDropdown && (
                  <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                    {results.length === 0 ? (
                      <div className="px-3 py-3 text-sm text-gray-500 text-center">未找到匹配的跟进人</div>
                    ) : (
                      results.map((op) => (
                        <button
                          key={op.id}
                          type="button"
                          onClick={() => handleSelect(op)}
                          className="w-full text-left px-3 py-2 text-sm hover:bg-teal-50 transition-colors border-b border-gray-100 last:border-b-0"
                        >
                          <span className="font-medium text-gray-900">{op.name}</span>
                          {op.phone && (
                            <span className="ml-2 text-gray-400 text-xs">{op.phone}</span>
                          )}
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>

              {selected && (
                <div className="mt-2 p-2 bg-teal-50 border border-teal-200 rounded-lg text-sm flex items-center gap-2">
                  <svg className="w-4 h-4 text-teal-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-teal-700">
                    已选择：<strong>{selected.name}</strong>
                    {selected.phone && (
                      <span className="ml-1 text-teal-500 font-normal text-xs">({selected.phone})</span>
                    )}
                  </span>
                </div>
              )}
            </div>

            <div className="flex gap-3 justify-between">
              <div>
                {currentDefaultFollowUp && (
                  <button
                    onClick={handleClear}
                    disabled={isLoading}
                    className="px-4 py-2 text-sm font-medium text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition-colors disabled:opacity-50"
                  >
                    清除设置
                  </button>
                )}
              </div>
              <div className="flex gap-3">
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
                  className="px-4 py-2 text-sm font-medium text-white bg-teal-600 rounded-lg hover:bg-teal-700 transition-colors disabled:opacity-50"
                >
                  {isLoading ? '设置中...' : '确定'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
