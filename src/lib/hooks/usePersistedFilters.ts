'use client'

import { useEffect, useRef } from 'react'

/**
 * 筛选条件持久化（页面回退/跳转返回场景保持）：
 * - 已应用的筛选以 URL 为真源，回退时由服务端经 initialFilters 回显（本 Hook 不干预）；
 * - 已输入但未点「筛选」的值，保存到 sessionStorage；再次进入页面时，
 *   仅对 URL 中未携带的筛选项做一次性恢复（URL 优先，避免覆盖已应用条件）。
 *
 * 用法：
 *   usePersistedFilters('admin-teacher-filters', values, setters)
 *   // 重置按钮里调用 clearPersistedFilters('admin-teacher-filters')
 */
export function usePersistedFilters(
  storageKey: string,
  values: Record<string, string>,
  setters: Record<string, (value: string) => void>
): void {
  const restoredRef = useRef(false)
  const valuesJson = JSON.stringify(values)

  // 挂载后一次性恢复：仅补齐 URL 未携带、且当前为空的项
  useEffect(() => {
    if (restoredRef.current) return
    restoredRef.current = true
    try {
      const saved = JSON.parse(sessionStorage.getItem(storageKey) || '{}') as Record<string, string>
      for (const [key, setter] of Object.entries(setters)) {
        const fromUrl = (values as Record<string, string>)[key]
        const savedVal = saved[key]
        if ((!fromUrl || fromUrl === '') && typeof savedVal === 'string' && savedVal !== '') {
          setter(savedVal)
        }
      }
    } catch {
      // sessionStorage 不可用（隐私模式等）时静默跳过
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 任一筛选项变化时保存快照
  useEffect(() => {
    try {
      sessionStorage.setItem(storageKey, valuesJson)
    } catch {
      // 忽略存储异常
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [valuesJson, storageKey])
}

/** 清空该页面保存的筛选快照（在「重置」按钮中调用，避免重置后被恢复） */
export function clearPersistedFilters(storageKey: string): void {
  try {
    sessionStorage.removeItem(storageKey)
  } catch {
    // 忽略
  }
}
