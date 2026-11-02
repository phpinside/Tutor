/**
 * 运营特批授课能力（学段 + 科目）：跨端共享的选项与解析（非 'use server'）。
 * 可见性约定：教练不可见（独立表，教练端查询不触碰）；学管可见但不可修改；仅运营/超管可设置。
 * 应用：该属性供教练可派单资格审查读取。
 */

// —— 学段特批 ——
export const TEACHING_APPROVAL_OPTIONS = [
  { code: 'PRIMARY', label: '小学' },
  { code: 'JUNIOR', label: '初中' },
  { code: 'JUNIOR_3', label: '初三' },
  { code: 'SENIOR', label: '高中' },
  { code: 'SENIOR_3', label: '高三' },
] as const

export type TeachingApprovalLevel = (typeof TEACHING_APPROVAL_OPTIONS)[number]['code']

export const TEACHING_APPROVAL_CODES: readonly string[] = TEACHING_APPROVAL_OPTIONS.map(
  (o) => o.code
)

export const TEACHING_APPROVAL_LABELS: Record<string, string> = Object.fromEntries(
  TEACHING_APPROVAL_OPTIONS.map((o) => [o.code, o.label])
)

// —— 科目特批 ——
export const TEACHING_APPROVAL_SUBJECT_OPTIONS = [
  { code: 'MATH', label: '数学' },
  { code: 'PHYSICS', label: '物理' },
  { code: 'CHEMISTRY', label: '化学' },
] as const

export type TeachingApprovalSubject = (typeof TEACHING_APPROVAL_SUBJECT_OPTIONS)[number]['code']

export const TEACHING_APPROVAL_SUBJECT_CODES: readonly string[] =
  TEACHING_APPROVAL_SUBJECT_OPTIONS.map((o) => o.code)

export const TEACHING_APPROVAL_SUBJECT_LABELS: Record<string, string> = Object.fromEntries(
  TEACHING_APPROVAL_SUBJECT_OPTIONS.map((o) => [o.code, o.label])
)

/** 解析逗号分隔的 code 列表 → 去重、过滤非法值 */
function parseApprovalCodes(value: string | null | undefined, validCodes: readonly string[]): string[] {
  if (!value) return []
  const codes = value
    .split(',')
    .map((c) => c.trim())
    .filter((c) => validCodes.includes(c))
  return Array.from(new Set(codes))
}

/** 按选项顺序排列已选 code */
function orderApprovalCodes(codes: string[], options: readonly { code: string }[]): string[] {
  return options.filter((o) => codes.includes(o.code)).map((o) => o.code)
}

/** 解析存储值（逗号分隔 code）→ 去重后的学段 code 数组（非法值过滤，按选项顺序） */
export function parseTeachingApprovalLevels(value: string | null | undefined): string[] {
  return orderApprovalCodes(
    parseApprovalCodes(value, TEACHING_APPROVAL_CODES),
    TEACHING_APPROVAL_OPTIONS
  )
}

/** 解析存储值（逗号分隔 code）→ 去重后的科目 code 数组（非法值过滤，按选项顺序） */
export function parseTeachingApprovalSubjects(value: string | null | undefined): string[] {
  return orderApprovalCodes(
    parseApprovalCodes(value, TEACHING_APPROVAL_SUBJECT_CODES),
    TEACHING_APPROVAL_SUBJECT_OPTIONS
  )
}

/** 学段 code 数组 → 展示文案 */
export function formatTeachingApprovalLevels(levels: string[]): string {
  return TEACHING_APPROVAL_OPTIONS.filter((o) => levels.includes(o.code))
    .map((o) => o.label)
    .join('、')
}

/** 科目 code 数组 → 展示文案 */
export function formatTeachingApprovalSubjects(subjects: string[]): string {
  return TEACHING_APPROVAL_SUBJECT_OPTIONS.filter((o) => subjects.includes(o.code))
    .map((o) => o.label)
    .join('、')
}
