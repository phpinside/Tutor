/**
 * 教练资料修改申请：跨端共享的类型与文案（非 'use server'，可被客户端组件直接引用）。
 */

export type InfoChangeRequestStatus =
  | 'PENDING_FIRST_REVIEW'
  | 'PENDING_FINAL_REVIEW'
  | 'APPROVED'
  | 'REJECTED'
  | 'CANCELLED'

export const INFO_CHANGE_STATUS_LABELS: Record<InfoChangeRequestStatus, string> = {
  PENDING_FIRST_REVIEW: '待初审',
  PENDING_FINAL_REVIEW: '待复审',
  APPROVED: '已生效',
  REJECTED: '已驳回',
  CANCELLED: '已撤回',
}

export const INFO_CHANGE_STATUS_BADGE: Record<InfoChangeRequestStatus, string> = {
  PENDING_FIRST_REVIEW: 'badge-gray',
  PENDING_FINAL_REVIEW: 'badge-gray',
  APPROVED: 'badge-success',
  REJECTED: 'badge-danger',
  CANCELLED: 'badge-gray',
}

/** 申请单视图（日期已序列化为 ISO 字符串，可安全跨越 RSC/Action 边界） */
export interface InfoChangeItemView {
  id: string
  status: InfoChangeRequestStatus
  requestKind: InfoChangeRequestKind
  changes: Record<string, { from: unknown; to: unknown }>
  qualificationChanges: QualificationChangePayload | null
  proofImages: string[]
  reason: string | null
  createdAt: string
  appliedAt: string | null
  firstReviewerName: string | null
  firstReviewedAt: string | null
  firstReviewNote: string | null
  finalReviewerName: string | null
  finalReviewedAt: string | null
  finalReviewNote: string | null
}

/** 审核工作台视图：申请单 + 教练当前值（用于漂移提示）+ 已签名的证明图 URL */
export interface InfoChangeReviewItemView extends InfoChangeItemView {
  teacher: { id: string; name: string; phone: string }
  /** 教练当前值：敏感字段 + 资质专项字段（字符串化） */
  teacherCurrent: Record<string, string>
  proofUrls: Record<string, string>
  /** QUALIFICATION 申请：资质材料文件（签名 URL，2 小时有效） */
  qualificationFiles: { key: string; url: string }[]
}

/** 教练资料修改申请涉及的敏感字段 key（与 SENSITIVE_FIELDS 保持一致） */
export type SensitiveFieldKey =
  | 'name'
  | 'gaokaoProvince'
  | 'mathScore'
  | 'physicsScore'
  | 'chemistryScore'
  | 'mathScoreTotal'
  | 'physicsScoreTotal'
  | 'chemistryScoreTotal'

/** 申请类别：高考信息修改 / 资质变更 */
export type InfoChangeRequestKind = 'SCORE_INFO' | 'QUALIFICATION'

export const INFO_CHANGE_KIND_LABELS: Record<InfoChangeRequestKind, string> = {
  SCORE_INFO: '高考信息修改',
  QUALIFICATION: '资质变更',
}

/** 资质变更可申请的字段（专项字段，随资质单复审通过后由系统同步） */
export const QUALIFICATION_FLAG_KEYS = [
  'hasTeacherCert',
  'teacherCertStage',
  'teacherCertSubject',
  'mandarinLevel',
  'hasDegreeCert',
  'isInServiceTeacher',
] as const

export type QualificationFlagKey = (typeof QUALIFICATION_FLAG_KEYS)[number]

export const QUALIFICATION_FLAG_LABELS: Record<QualificationFlagKey, string> = {
  hasTeacherCert: '是否持有教师资格证',
  teacherCertStage: '教师资格证学段',
  teacherCertSubject: '教师资格证学科',
  mandarinLevel: '普通话等级',
  hasDegreeCert: '学历/在读证明',
  isInServiceTeacher: '是否在职教师',
}

/** 资质变更单的目标资质集合 */
export interface QualificationChangePayload {
  items: {
    type: 'DEGREE_CERT' | 'TEACHER_CERT' | 'MANDARIN_CERT'
    files: string[]
    meta: {
      degreeLevel?: string
      verifyCode?: string
      certStage?: string
      certSubject?: string
      mandarinLevel?: string
    }
  }[]
  isInServiceTeacher: boolean
}

/** 解析 qualificationChanges JSON → 结构化载荷（非法结构返回 null） */
export function parseQualificationChangePayload(value: unknown): QualificationChangePayload | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const record = value as Record<string, unknown>
  if (typeof record.isInServiceTeacher !== 'boolean') return null
  if (!Array.isArray(record.items)) return null
  const items: QualificationChangePayload['items'] = []
  for (const entry of record.items) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return null
    const e = entry as Record<string, unknown>
    const type = e.type
    if (type !== 'DEGREE_CERT' && type !== 'TEACHER_CERT' && type !== 'MANDARIN_CERT') return null
    if (!Array.isArray(e.files) || e.files.some((f) => typeof f !== 'string')) return null
    const meta = (e.meta && typeof e.meta === 'object' && !Array.isArray(e.meta) ? e.meta : {}) as QualificationChangePayload['items'][number]['meta']
    items.push({ type, files: e.files as string[], meta })
  }
  return { items, isInServiceTeacher: record.isInServiceTeacher }
}

/**
 * 「信息真实性承诺」文案版本号：文案发生实质变更时递增，
 * 审计日志记录该版本以便追溯用户确认时的具体承诺内容。
 */
export const AUTHENTICITY_COMMITMENT_VERSION = 1

export const MAX_PROOF_IMAGES = 3
export const MAX_REASON_LENGTH = 200

/** 申请单原始行（Prisma 查询结果） → 视图对象 */
export function toInfoChangeItemView(row: {
  id: string
  status: InfoChangeRequestStatus
  requestKind: string
  changes: unknown
  proofImages: unknown
  qualificationChanges: unknown
  reason: string | null
  createdAt: Date
  appliedAt: Date | null
  firstReviewerName: string | null
  firstReviewedAt: Date | null
  firstReviewNote: string | null
  finalReviewerName: string | null
  finalReviewedAt: Date | null
  finalReviewNote: string | null
}): InfoChangeItemView {
  return {
    id: row.id,
    status: row.status,
    requestKind: row.requestKind === 'QUALIFICATION' ? 'QUALIFICATION' : 'SCORE_INFO',
    changes: parseChanges(row.changes),
    qualificationChanges: parseQualificationChangePayload(row.qualificationChanges),
    proofImages: parseProofImages(row.proofImages),
    reason: row.reason,
    createdAt: row.createdAt.toISOString(),
    appliedAt: row.appliedAt?.toISOString() ?? null,
    firstReviewerName: row.firstReviewerName,
    firstReviewedAt: row.firstReviewedAt?.toISOString() ?? null,
    firstReviewNote: row.firstReviewNote,
    finalReviewerName: row.finalReviewerName,
    finalReviewedAt: row.finalReviewedAt?.toISOString() ?? null,
    finalReviewNote: row.finalReviewNote,
  }
}

/** 解析 changes JSON：字段 → { from, to } */
export function parseChanges(value: unknown): Record<string, { from: unknown; to: unknown }> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  const out: Record<string, { from: unknown; to: unknown }> = {}
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    if (entry && typeof entry === 'object' && !Array.isArray(entry) && 'from' in entry && 'to' in entry) {
      out[key] = { from: (entry as { from: unknown }).from, to: (entry as { to: unknown }).to }
    }
  }
  return out
}

/** 解析 proofImages JSON：七牛 key 数组 */
export function parseProofImages(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((v): v is string => typeof v === 'string')
}
