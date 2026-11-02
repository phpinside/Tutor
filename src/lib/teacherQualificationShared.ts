/**
 * 教练资质证明：跨端共享的类型与文案（非 'use server'）。
 */

export type QualificationType = 'DEGREE_CERT' | 'TEACHER_CERT' | 'MANDARIN_CERT' | 'GAOKAO_SCORE'

export const QUALIFICATION_TYPE_LABELS: Record<QualificationType, string> = {
  DEGREE_CERT: '学历学位证或在读学生证（学信网在线验证报告）',
  TEACHER_CERT: '教师资格证',
  MANDARIN_CERT: '普通话等级证',
  GAOKAO_SCORE: '高考成绩查询结果',
}

export const QUALIFICATION_SOURCE_LABELS: Record<'ONBOARDING' | 'CHALLENGE', string> = {
  ONBOARDING: '入驻申报',
  CHALLENGE: '质疑取证补交',
}

export const TEACHER_CERT_STAGES = ['PRIMARY', 'JUNIOR', 'SENIOR'] as const
export const TEACHER_CERT_STAGE_LABELS: Record<string, string> = {
  PRIMARY: '小学',
  JUNIOR: '初中',
  SENIOR: '高中',
}

export const TEACHER_CERT_SUBJECTS = ['MATH', 'PHYSICS', 'CHEMISTRY', 'OTHER'] as const
export const TEACHER_CERT_SUBJECT_LABELS: Record<string, string> = {
  MATH: '数学',
  PHYSICS: '物理',
  CHEMISTRY: '化学',
  OTHER: '其它',
}

export const MANDARIN_LEVELS = [
  '一级甲等',
  '一级乙等',
  '二级甲等',
  '二级乙等',
  '三级甲等',
  '三级乙等',
] as const

export const DEGREE_LEVELS = [
  '在读本科',
  '在读硕士',
  '在读博士',
  '本科毕业',
  '硕士毕业',
  '博士毕业',
  '其它',
] as const

/** 资质附件元信息 */
export interface QualificationMeta {
  degreeLevel?: string // DEGREE_CERT：学历层次
  verifyCode?: string // DEGREE_CERT：学信网在线验证码（选填）
  certStage?: string // TEACHER_CERT：学段
  certSubject?: string // TEACHER_CERT：学科
  mandarinLevel?: string // MANDARIN_CERT：等级
}

/** 资质证明视图（文件 key 已解析，日期 ISO 化） */
export interface QualificationItemView {
  id: string
  type: QualificationType
  source: 'ONBOARDING' | 'CHALLENGE'
  files: string[]
  meta: QualificationMeta
  challengeRound: number | null
  createdAt: string
}

const QUALIFICATION_META_MAX = 50

/** 解析 files JSON → key 数组 */
export function parseQualificationFiles(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((v): v is string => typeof v === 'string')
}

/** 解析 meta JSON → 元信息对象 */
export function parseQualificationMeta(value: unknown): QualificationMeta {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  const record = value as Record<string, unknown>
  const pick = (key: string): string | undefined => {
    const v = record[key]
    return typeof v === 'string' && v.trim() ? v.trim().slice(0, QUALIFICATION_META_MAX) : undefined
  }
  return {
    degreeLevel: pick('degreeLevel'),
    verifyCode: pick('verifyCode'),
    certStage: pick('certStage'),
    certSubject: pick('certSubject'),
    mandarinLevel: pick('mandarinLevel'),
  }
}
