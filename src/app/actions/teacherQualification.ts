'use server'

import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import { cookies } from 'next/headers'
import { recordAudit } from '@/lib/auditLog'
import { hasPassedOnboarding } from '@/lib/teacherSensitiveFields'
import {
  QUALIFICATION_TYPE_LABELS,
  TEACHER_CERT_STAGES,
  TEACHER_CERT_SUBJECTS,
  MANDARIN_LEVELS,
  parseQualificationFiles,
  parseQualificationMeta,
} from '@/lib/teacherQualificationShared'
import type {
  QualificationItemView,
  QualificationMeta,
  QualificationType,
} from '@/lib/teacherQualificationShared'

// 教练资质证明：入驻表单申报（整体替换）与质疑取证补交
// 权限：教练本人；文件必须经 /api/upload/qualification 上传（key 前缀校验）

const QUALIFICATION_KEY_PREFIX = 'uploads/qualifications/'
const MAX_FILES_PER_ITEM = 2

/** 入驻表单可申报的类型（GAOKAO_SCORE 仅用于质疑取证补交） */
const ONBOARDING_TYPES: QualificationType[] = ['DEGREE_CERT', 'TEACHER_CERT', 'MANDARIN_CERT']

function validateFiles(teacherId: string, files: unknown): { keys?: string[]; error?: string } {
  const keys = Array.isArray(files)
    ? files.map((f) => String(f).trim()).filter(Boolean)
    : []
  if (keys.length === 0) return { error: '请上传证明文件' }
  if (keys.length > MAX_FILES_PER_ITEM) return { error: `每类证明最多 ${MAX_FILES_PER_ITEM} 个文件` }
  const foreign = keys.find((k) => !k.startsWith(`${QUALIFICATION_KEY_PREFIX}${teacherId}-`))
  if (foreign) return { error: '证明文件无效，请重新上传' }
  return { keys }
}

function validateMeta(type: QualificationType, meta: QualificationMeta): string | null {
  if (type === 'TEACHER_CERT') {
    const isStage = (meta.certStage ?? '').length > 0 && (TEACHER_CERT_STAGES as readonly string[]).includes(meta.certStage as never)
    const isSubject = (meta.certSubject ?? '').length > 0 && (TEACHER_CERT_SUBJECTS as readonly string[]).includes(meta.certSubject as never)
    if (!isStage || !isSubject) return '教师资格证需选择对应的学段与学科'
  }
  if (type === 'MANDARIN_CERT') {
    const isLevel = (meta.mandarinLevel ?? '').length > 0 && (MANDARIN_LEVELS as readonly string[]).includes(meta.mandarinLevel as never)
    if (!isLevel) return '普通话等级证需选择对应等级'
  }
  return null
}

// 查询本人的资质证明（完成页/任务表单/补证卡片共用）
export async function getMyQualifications(): Promise<{
  success: boolean
  items?: QualificationItemView[]
  error?: string
}> {
  try {
    const teacherId = (await cookies()).get('teacherId')?.value
    if (!teacherId) return { success: false, error: '请先登录' }

    const rows = await prisma.teacherQualification.findMany({
      where: { teacherId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    })
    const items: QualificationItemView[] = rows.map((row) => ({
      id: row.id,
      type: row.type as QualificationType,
      source: row.source as 'ONBOARDING' | 'CHALLENGE',
      files: parseQualificationFiles(row.files),
      meta: parseQualificationMeta(row.meta),
      challengeRound: row.challengeRound,
      createdAt: row.createdAt.toISOString(),
    }))
    return { success: true, items }
  } catch (error) {
    console.error('查询资质证明失败:', error)
    return { success: false, error: '查询失败，请重试' }
  }
}

// 入驻表单提交：整体替换 ONBOARDING 来源的资质，并同步 Teacher 专项字段（申报口径）
// 入驻审核通过后教练不可再自助变更资质，需走「资料修改申请」流程（复审通过由系统同步）
export async function saveTeacherQualifications(input: {
  items: {
    type: QualificationType
    files: string[]
    meta?: QualificationMeta
  }[]
  isInServiceTeacher?: boolean
}) {
  try {
    const teacherId = (await cookies()).get('teacherId')?.value
    if (!teacherId) return { success: false as const, error: '请先登录' }

    if (await hasPassedOnboarding(teacherId)) {
      return {
        success: false as const,
        error: '入驻审核已通过，资质变更请前往完成页使用「资料修改申请」提交',
      }
    }

    const rawItems = Array.isArray(input.items) ? input.items : []
    const types = rawItems.map((i) => i?.type)
    if (types.some((t) => !(ONBOARDING_TYPES as string[]).includes(t))) {
      return { success: false as const, error: '包含不支持的资质类型' }
    }
    if (new Set(types).size !== types.length) {
      return { success: false as const, error: '同一资质类型重复提交' }
    }

    const prepared: {
      type: QualificationType
      files: string[]
      meta: QualificationMeta
    }[] = []
    for (const item of rawItems) {
      const meta = item.meta ?? {}
      const fileResult = validateFiles(teacherId, item.files)
      if (fileResult.error) return { success: false as const, error: fileResult.error }
      const metaError = validateMeta(item.type, meta)
      if (metaError) return { success: false as const, error: metaError }
      prepared.push({ type: item.type, files: fileResult.keys!, meta })
    }

    const degreeItem = prepared.find((i) => i.type === 'DEGREE_CERT')
    const teacherCertItem = prepared.find((i) => i.type === 'TEACHER_CERT')
    const mandarinItem = prepared.find((i) => i.type === 'MANDARIN_CERT')

    const teacher = await prisma.teacher.findUnique({
      where: { id: teacherId },
      select: { name: true },
    })
    if (!teacher) return { success: false as const, error: '老师不存在' }

    await prisma.$transaction(async (tx) => {
      await tx.teacherQualification.deleteMany({
        where: { teacherId, source: 'ONBOARDING' },
      })
      if (prepared.length > 0) {
        await tx.teacherQualification.createMany({
          data: prepared.map((item) => ({
            teacherId,
            type: item.type,
            source: 'ONBOARDING' as const,
            files: item.files as never,
            meta: item.meta as never,
          })),
        })
      }
      // 专项字段随申报同步（供其它服务直接读取；移除材料时同步清零）
      await tx.teacher.update({
        where: { id: teacherId },
        data: {
          isInServiceTeacher: input.isInServiceTeacher === true,
          hasDegreeCert: Boolean(degreeItem),
          hasTeacherCert: Boolean(teacherCertItem),
          teacherCertStage: teacherCertItem?.meta.certStage ?? null,
          teacherCertSubject: teacherCertItem?.meta.certSubject ?? null,
          mandarinLevel: mandarinItem?.meta.mandarinLevel ?? null,
        },
      })
    })

    await recordAudit({
      actorType: 'TEACHER',
      actorId: teacherId,
      actorName: teacher.name,
      action: 'SAVE_TEACHER_QUALIFICATIONS',
      targetType: 'TEACHER',
      targetId: teacherId,
      detail: {
        source: 'ONBOARDING',
        types: prepared.map((i) => i.type),
        isInServiceTeacher: input.isInServiceTeacher === true,
      },
    })

    revalidatePath('/onboarding')
    revalidatePath('/onboarding/task/1')
    revalidatePath(`/admin/teachers/${teacherId}`)
    return { success: true as const }
  } catch (error) {
    console.error('保存资质证明失败:', error)
    return { success: false as const, error: '保存失败，请重试' }
  }
}

// 质疑取证补交（教练本人；须处于 CHALLENGED 阶段且补交类型在要求清单内）
export async function saveChallengeEvidence(input: {
  type: QualificationType
  files: string[]
}) {
  try {
    const teacherId = (await cookies()).get('teacherId')?.value
    if (!teacherId) return { success: false as const, error: '请先登录' }

    const fileResult = validateFiles(teacherId, input.files)
    if (fileResult.error) return { success: false as const, error: fileResult.error }
    const keys = fileResult.keys!

    const review = await prisma.coachReview.findUnique({
      where: { teacherId },
      select: { id: true, stage: true, challengeItems: true, challengedAt: true, attemptCount: true },
    })
    if (!review || review.stage !== 'CHALLENGED') {
      return { success: false as const, error: '当前不处于质疑取证阶段' }
    }

    const requiredTypes = parseQualificationFiles(review.challengeItems) as QualificationType[]
    if (!requiredTypes.includes(input.type)) {
      return { success: false as const, error: '该证明类型不在质疑取证要求清单内' }
    }

    // 防刷：同一质疑轮次内，每类证明最多补交 3 份
    const existingCount = await prisma.teacherQualification.count({
      where: {
        teacherId,
        type: input.type,
        source: 'CHALLENGE',
        createdAt: { gt: review.challengedAt ?? new Date(0) },
      },
    })
    if (existingCount >= 3) {
      return { success: false as const, error: '该证明本轮已补交 3 份，请直接重新提交审核' }
    }

    const teacher = await prisma.teacher.findUnique({
      where: { id: teacherId },
      select: { name: true },
    })
    if (!teacher) return { success: false as const, error: '老师不存在' }

    await prisma.teacherQualification.create({
      data: {
        teacherId,
        type: input.type,
        source: 'CHALLENGE',
        files: keys as never,
        meta: {} as never,
        challengeRound: review.attemptCount,
      },
    })

    await recordAudit({
      actorType: 'TEACHER',
      actorId: teacherId,
      actorName: teacher.name,
      action: 'SUBMIT_CHALLENGE_EVIDENCE',
      targetType: 'TEACHER',
      targetId: teacherId,
      detail: {
        type: input.type,
        typeLabel: QUALIFICATION_TYPE_LABELS[input.type],
        challengeRound: review.attemptCount,
      },
    })

    revalidatePath('/onboarding')
    revalidatePath(`/admin/teachers/${teacherId}`)
    return { success: true as const }
  } catch (error) {
    console.error('补交质疑取证材料失败:', error)
    return { success: false as const, error: '提交失败，请重试' }
  }
}
