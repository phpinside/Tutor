/**
 * 运营特批授课能力：跨端共享的选项与解析（非 'use server'）。
 * 可见性约定：教练不可见（独立表，教练端查询不触碰）；学管可见但不可修改；仅运营/超管可设置。
 * 应用：该属性供教练可派单资格审查读取。
 */

export const TEACHING_APPROVAL_OPTIONS = [
  { code: 'PRIMARY', label: '小学' },
  { code: 'JUNIOR', label: '初一/初二' },
  { code: 'JUNIOR_3', label: '初三' },
  { code: 'SENIOR', label: '高一/高二' },
  { code: 'SENIOR_3', label: '高三' },
] as const

export type TeachingApprovalLevel = (typeof TEACHING_APPROVAL_OPTIONS)[number]['code']

export const TEACHING_APPROVAL_CODES: readonly string[] = TEACHING_APPROVAL_OPTIONS.map(
  (o) => o.code
)

export const TEACHING_APPROVAL_LABELS: Record<string, string> = Object.fromEntries(
  TEACHING_APPROVAL_OPTIONS.map((o) => [o.code, o.label])
)

/** 解析存储值（逗号分隔 code）→ 去重后的 code 数组（非法值过滤） */
export function parseTeachingApprovalLevels(value: string | null | undefined): string[] {
  if (!value) return []
  const codes = value
    .split(',')
    .map((c) => c.trim())
    .filter((c) => TEACHING_APPROVAL_CODES.includes(c))
  return Array.from(new Set(codes))
}

/** code 数组 → 展示文案（按选项顺序） */
export function formatTeachingApprovalLevels(levels: string[]): string {
  return TEACHING_APPROVAL_OPTIONS.filter((o) => levels.includes(o.code))
    .map((o) => o.label)
    .join('、')
}
