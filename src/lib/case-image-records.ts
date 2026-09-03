import type { CaseImageRecord } from '@prisma/client'
import { generateCaseImagePrivateUrl } from '@/lib/qiniu'

/** 案例图生成记录的可序列化 DTO（客户端使用，所有日期均为 ISO 字符串） */
export type CaseImageRecordDTO = {
  id: string
  teacherId: string
  templateId: string | null
  templateName: string | null
  studentRegion: string
  studentName: string
  studentGrade: string
  scoreTitle: string
  studyDuration: string
  scoreIncrease: string
  teamName: string
  coachSignature: string
  bottomNote: string | null
  /** 查看大图用的签名 URL（1 小时有效） */
  imageUrl: string
  /** 强制下载用的签名 URL（attname） */
  imageDownloadUrl: string
  createdAt: string
  teacherName?: string
  teacherPhone?: string
}

/**
 * 将 CaseImageRecord 序列化为客户端可用的 DTO。
 * 签名 URL 在每次服务端渲染/接口返回时生成，有效期 1 小时。
 */
export function serializeCaseImageRecord(
  record: CaseImageRecord,
  teacher?: { name?: string | null; phone?: string | null }
): CaseImageRecordDTO {
  return {
    id: record.id,
    teacherId: record.teacherId,
    templateId: record.templateId,
    templateName: record.templateName,
    studentRegion: record.studentRegion,
    studentName: record.studentName,
    studentGrade: record.studentGrade,
    scoreTitle: record.scoreTitle,
    studyDuration: record.studyDuration,
    scoreIncrease: record.scoreIncrease,
    teamName: record.teamName,
    coachSignature: record.coachSignature,
    bottomNote: record.bottomNote,
    imageUrl: generateCaseImagePrivateUrl(record.imageKey),
    imageDownloadUrl: generateCaseImagePrivateUrl(record.imageKey, { download: true }),
    createdAt: record.createdAt.toISOString(),
    teacherName: teacher?.name ?? undefined,
    teacherPhone: teacher?.phone ?? undefined,
  }
}
