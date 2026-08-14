'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { searchOperators } from '@/app/actions/operatorActions'

interface OperatorOption {
  id: string
  name: string
  phone: string
}

interface OperatorPickerModalProps {
  triggerLabel: string
  title: string
  description?: string
  currentOperator: { id: string; name: string; phone?: string } | null
  currentLabel?: string
  submitLabel?: string
  allowClear?: boolean
  clearLabel?: string
  emptyLabel?: string
  onSubmit: (
    operatorId: string | null
  ) => Promise<{ success: boolean; error?: string }>
  successMessage: (name: string) => string
  clearSuccessMessage?: string
  buttonClassName?: string
}

export default function OperatorPickerModal({
  triggerLabel,
  title,
  description,
  currentOperator,
  currentLabel = '当前',
  submitLabel = '确定',
  allowClear = false,
  clearLabel = '清除设置',
  emptyLabel = '当前未设置',
  onSubmit,
  successMessage,
  clearSuccessMessage,
  buttonClassName = 'px-4 py-2 text-sm font-medium text-white bg-teal-600 rounded-lg hover:bg-teal-700 transition-colors',
}: OperatorPickerModalProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<OperatorOption[]>([])
  const [selected, setSelected] = useState<OperatorOption | null>(null)
  const [isSearching, setIsSearching] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
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
      setError('请先搜索并选择运营账号')
      return
    }

    setIsLoading(true)
    setError(null)
    try {
      const result = await onSubmit(selected.id)
      if (result.success) {
        alert(successMessage(selected.name))
        handleClose()
        router.refresh()
      } else {
        setError(result.error || '操作失败，请重试')
      }
    } catch {
      setError('操作失败，请重试')
    } finally {
      setIsLoading(false)
    }
  }

  const handleClear = async () => {
    if (!confirm(`确定要${clearLabel}吗？`)) return

    setIsLoading(true)
    setError(null)
    try {
      const result = await onSubmit(null)
      if (result.success) {
        alert(clearSuccessMessage || '已清除设置')
        handleClose()
        router.refresh()
      } else {
        setError(result.error || '操作失败，请重试')
      }
    } catch {
      setError('操作失败，请重试')
    } finally {
      setIsLoading(false)
    }
  }

  const handleClose = () => {
    setOpen(false)
    setQuery('')
    setResults([])
    setSelected(null)
    setShowDropdown(false)
    setError(null)
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={buttonClassName}
      >
        {triggerLabel}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={handleClose} />

          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md mx-4 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">{title}</h2>

            {description && (
              <div className="mb-4 p-3 bg-teal-50 border border-teal-200 rounded-lg text-sm text-teal-800">
                {description}
              </div>
            )}

            {currentOperator ? (
              <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm">
                <p className="text-amber-700 font-medium mb-1">{currentLabel}</p>
                <p className="text-amber-900">
                  {currentOperator.name}
                  {currentOperator.phone && (
                    <span className="ml-2 text-amber-600 text-xs">{currentOperator.phone}</span>
                  )}
                </p>
              </div>
            ) : (
              <div className="mb-4 p-3 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-500">
                {emptyLabel}
              </div>
            )}

            {error && (
              <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-800">
                {error}
              </div>
            )}

            <div className="mb-6" ref={dropdownRef}>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                搜索运营账号
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
                      <div className="px-3 py-3 text-sm text-gray-500 text-center">未找到匹配的运营账号</div>
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
                {allowClear && currentOperator && (
                  <button
                    onClick={handleClear}
                    disabled={isLoading}
                    className="px-4 py-2 text-sm font-medium text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition-colors disabled:opacity-50"
                  >
                    {clearLabel}
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
                  {isLoading ? '设置中...' : submitLabel}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
