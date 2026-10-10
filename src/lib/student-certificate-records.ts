import type { StudentCertificateRecord } from '@prisma/client'
import { generateCaseImagePrivateUrl } from '@/lib/qiniu'

export type StudentCertificateRecordDTO = Omit<StudentCertificateRecord, 'createdAt' | 'imageKey'> & {
  createdAt: string
  imageUrl: string
  imageDownloadUrl: string
  teacherName?: string
  teacherPhone?: string
}

export function serializeStudentCertificateRecord(record: StudentCertificateRecord, teacher?: { name: string | null; phone: string | null }): StudentCertificateRecordDTO {
  return {
    id: record.id, teacherId: record.teacherId, templateId: record.templateId,
    templateName: record.templateName, orientation: record.orientation, studentName: record.studentName, grade: record.grade,
    subject: record.subject, awardName: record.awardName, citation: record.citation,
    issuer: record.issuer, issueDate: record.issueDate, teamName: record.teamName,
    coachName: record.coachName, createdAt: record.createdAt.toISOString(),
    imageUrl: generateCaseImagePrivateUrl(record.imageKey),
    imageDownloadUrl: generateCaseImagePrivateUrl(record.imageKey, { download: true }),
    teacherName: teacher?.name ?? undefined, teacherPhone: teacher?.phone ?? undefined,
  }
}
