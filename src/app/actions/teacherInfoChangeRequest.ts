'use server'

import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import { cookies } from 'next/headers'
import { recordAudit } from '@/lib/auditLog'
import { isSuperAdmin } from '@/lib/admin-auth'
import { getOperatorSessionInfo } from '@/lib/operatorAuth'
import { isTeacherInScope } from '@/lib/learnerManagerScope'
import { GAOKAO_PROVINCE_OPTIONS } from '@/lib/gaokaoProvinces'
import {
  SENSITIVE_FIELDS,
  SENSITIVE_FIELD_LABELS,
  SENSITIVE_FIELD_SET,
  hasPassedOnboarding,
  isSameValue,
} from '@/lib/teacherSensitiveFields'
import type { SensitiveField } from '@/lib/teacherSensitiveFields'
import type { InfoChangeItemView } from '@/lib/teacherInfoChangeShared'
import {
  toInfoChangeItemView,
  parseChanges,
  AUTHENTICITY_COMMITMENT_VERSION,
  MAX_PROOF_IMAGES,
  MAX_REASON_LENGTH,
} from '@/lib/teacherInfoChangeShared'

// 教练资料修改申请（敏感字段：姓名/高考省份/高考成绩）
// 流程：教练提交 → 学管初审（运营可兜底）→ 运营复审 → 事务内生效

export type InfoChangeRequestInput = {
  changes: Partial<Record<SensitiveField, string | number>>
  proofImages: string[]
  reason?: string
  /** 必须为 true：已在 UI 阅读并勾选「信息真实性承诺」 */
  commitmentAccepted?: boolean
}

/** 校验单个敏感字段取值合法性；返回 null 表示合法 */
function validateSensitiveValue(field: SensitiveField, value: unknown): string | null {
  switch (field) {
    case 'name': {
      const v = typeof value === 'string' ? value.trim() : ''
      if (!v || v.length > 30) return '姓名不能为空且不超过 30 字'
      return null
    }
    case 'gaokaoProvince': {
      if (typeof value !== 'string' || !GAOKAO_PROVINCE_OPTIONS.includes(value)) {
        return '高考省份不合法'
      }
      return null
    }
    case 'mathScore': {
      if (typeof value !== 'number' || !Number.isInteger(value) || value < 0 || value > 150) {
        return '高考数学成绩需为 0-150 的整数'
      }
      return null
    }
    case 'physicsScore':
    case 'chemistryScore': {
      // 物理/化学满分因省份与年代而异（老高考理综可达 110/100），上限放宽到 300
      if (typeof value !== 'number' || !Number.isInteger(value) || value < 0 || value > 300) {
        return `${SENSITIVE_FIELD_LABELS[field]}需为 0-300 的整数`
      }
      return null
    }
  }
}

type Reviewer = { id: string; name: string; role: 'LEARNER_MANAGER' | 'OPERATOR' | 'ADMIN' }

/** 解析审核人：超管优先，其次运营/学管会话（以 DB 中角色与启用状态为准） */
async function resolveReviewer(): Promise<Reviewer | null> {
  if (await isSuperAdmin()) {
    return { id: 'super_admin', name: '管理员', role: 'ADMIN' }
  }
  const session = await getOperatorSessionInfo()
  if (!session) return null
  const operator = await prisma.operator.findUnique({
    where: { id: session.operatorId },
    select: { name: true, isEnabled: true, role: true },
  })
  if (!operator || !operator.isEnabled) return null
  if (operator.role !== 'LEARNER_MANAGER' && operator.role !== 'OPERATOR') return null
  return { id: session.operatorId, name: operator.name, role: operator.role }
}

// 教练提交资料修改申请（仅本人，需已通过入驻审核）
export async function submitInfoChangeRequest(input: InfoChangeRequestInput) {
  try {
    const teacherId = (await cookies()).get('teacherId')?.value
    if (!teacherId) return { success: false as const, error: '请先登录' }

    if (!(await hasPassedOnboarding(teacherId))) {
      return { success: false as const, error: '入驻审核通过后才能申请修改资料' }
    }

    // 服务端强制：必须先阅读并勾选「信息真实性承诺」（防绕过 UI）
    if (!input.commitmentAccepted) {
      return { success: false as const, error: '请先阅读并勾选「信息真实性承诺」后再提交' }
    }

    const proofKeys = (input.proofImages ?? [])
      .map((k) => String(k).trim())
      .filter(Boolean)
    if (proofKeys.length === 0) {
      return { success: false as const, error: '请上传高考成绩查询截图作为证明材料' }
    }
    if (proofKeys.length > MAX_PROOF_IMAGES) {
      return { success: false as const, error: `证明材料最多 ${MAX_PROOF_IMAGES} 张` }
    }
    // 证明材料必须来自本人在申请通道上传的文件（key 由 /api/upload/info-change-proof 生成）
    const foreignProof = proofKeys.find(
      (key) => !key.startsWith(`uploads/info-change-proof/${teacherId}-`)
    )
    if (foreignProof) {
      return { success: false as const, error: '证明材料无效，请重新上传截图' }
    }

    const reason = input.reason?.trim() || null
    if (reason && reason.length > MAX_REASON_LENGTH) {
      return { success: false as const, error: `修改说明不能超过 ${MAX_REASON_LENGTH} 字` }
    }

    const rawChanges = input.changes ?? {}
    const invalidKeys = Object.keys(rawChanges).filter((k) => !SENSITIVE_FIELD_SET.has(k))
    if (invalidKeys.length > 0) {
      return { success: false as const, error: '申请包含不可修改的字段' }
    }

    const teacher = await prisma.teacher.findUnique({ where: { id: teacherId } })
    if (!teacher) return { success: false as const, error: '老师不存在' }

    const record = teacher as unknown as Record<string, unknown>
    const changes: Record<string, { from: unknown; to: unknown }> = {}
    for (const field of SENSITIVE_FIELDS) {
      const to = rawChanges[field]
      if (to === undefined) continue
      const invalid = validateSensitiveValue(field, to)
      if (invalid) return { success: false as const, error: invalid }
      if (!isSameValue(record[field], to)) {
        changes[field] = { from: record[field] ?? null, to }
      }
    }
    if (Object.keys(changes).length === 0) {
      return { success: false as const, error: '未检测到任何修改内容' }
    }

    const pending = await prisma.teacherInfoChangeRequest.findFirst({
      where: {
        teacherId,
        status: { in: ['PENDING_FIRST_REVIEW', 'PENDING_FINAL_REVIEW'] },
      },
      select: { id: true },
    })
    if (pending) {
      return { success: false as const, error: '已有待审核的修改申请，请等待审核完成后再提交' }
    }

    const created = await prisma.teacherInfoChangeRequest.create({
      data: {
        teacherId,
        changes: changes as never,
        proofImages: proofKeys as never,
        reason,
      },
    })

    // 承诺确认留痕：记录确认人、入口与文案版本
    await recordAudit({
      actorType: 'TEACHER',
      actorId: teacherId,
      actorName: teacher.name,
      action: 'ACCEPT_AUTHENTICITY_COMMITMENT',
      targetType: 'TEACHER',
      targetId: teacherId,
      detail: { source: 'INFO_CHANGE_REQUEST', version: AUTHENTICITY_COMMITMENT_VERSION },
    })

    await recordAudit({
      actorType: 'TEACHER',
      actorId: teacherId,
      actorName: teacher.name,
      action: 'SUBMIT_INFO_CHANGE_REQUEST',
      targetType: 'TEACHER_INFO_CHANGE_REQUEST',
      targetId: created.id,
      detail: { teacherId, fields: Object.keys(changes), changes },
    })

    revalidatePath('/onboarding/complete')
    revalidatePath('/admin/teachers/info-change-requests')
    return { success: true as const, requestId: created.id }
  } catch (error) {
    console.error('提交资料修改申请失败:', error)
    return { success: false as const, error: '提交失败，请重试' }
  }
}

// 教练撤回自己的待初审申请
export async function cancelInfoChangeRequest(requestId: string) {
  try {
    const teacherId = (await cookies()).get('teacherId')?.value
    if (!teacherId) return { success: false as const, error: '请先登录' }

    const request = await prisma.teacherInfoChangeRequest.findUnique({
      where: { id: requestId },
      select: { teacherId: true, status: true },
    })
    if (!request || request.teacherId !== teacherId) {
      return { success: false as const, error: '申请不存在' }
    }
    if (request.status !== 'PENDING_FIRST_REVIEW') {
      return { success: false as const, error: '仅待初审状态的申请可以撤回' }
    }

    const result = await prisma.teacherInfoChangeRequest.updateMany({
      where: { id: requestId, status: 'PENDING_FIRST_REVIEW' },
      data: { status: 'CANCELLED' },
    })
    if (result.count !== 1) {
      return { success: false as const, error: '撤回失败，请刷新后重试' }
    }

    await recordAudit({
      actorType: 'TEACHER',
      actorId: teacherId,
      action: 'CANCEL_INFO_CHANGE_REQUEST',
      targetType: 'TEACHER_INFO_CHANGE_REQUEST',
      targetId: requestId,
    })

    revalidatePath('/onboarding/complete')
    revalidatePath('/admin/teachers/info-change-requests')
    return { success: true as const }
  } catch (error) {
    console.error('撤回资料修改申请失败:', error)
    return { success: false as const, error: '操作失败，请重试' }
  }
}

// 初审：学管（白名单内）为主，运营可兜底，超管可越级
export async function firstReviewInfoChangeRequest(
  requestId: string,
  decision: 'APPROVED' | 'REJECTED',
  note?: string
) {
  try {
    const reviewer = await resolveReviewer()
    if (!reviewer) return { success: false as const, error: '无权限执行此操作' }

    const request = await prisma.teacherInfoChangeRequest.findUnique({
      where: { id: requestId },
      select: { teacherId: true, status: true },
    })
    if (!request) return { success: false as const, error: '申请不存在' }
    if (request.status !== 'PENDING_FIRST_REVIEW') {
      return { success: false as const, error: '该申请不在待初审状态' }
    }

    // 学管仅可初审白名单内教练；运营兜底；超管越级
    if (reviewer.role === 'LEARNER_MANAGER') {
      const inScope = await isTeacherInScope(reviewer.id, request.teacherId)
      if (inScope === false) {
        return { success: false as const, error: '该教练不在你的白名单内，无法初审' }
      }
    }

    const trimmedNote = note?.trim() || null
    if (decision === 'REJECTED' && !trimmedNote) {
      return { success: false as const, error: '驳回时必须填写原因' }
    }

    const result = await prisma.teacherInfoChangeRequest.updateMany({
      where: { id: requestId, status: 'PENDING_FIRST_REVIEW' },
      data: {
        status: decision === 'APPROVED' ? 'PENDING_FINAL_REVIEW' : 'REJECTED',
        firstReviewerId: reviewer.id,
        firstReviewerName: reviewer.name,
        firstReviewerRole: reviewer.role,
        firstReviewedAt: new Date(),
        firstReviewNote: trimmedNote,
      },
    })
    if (result.count !== 1) {
      return { success: false as const, error: '该申请已被处理，请刷新后重试' }
    }

    await recordAudit({
      actorType: reviewer.role === 'ADMIN' ? 'ADMIN' : 'OPERATOR',
      actorId: reviewer.id,
      actorName: reviewer.name,
      action: 'FIRST_REVIEW_INFO_CHANGE_REQUEST',
      targetType: 'TEACHER_INFO_CHANGE_REQUEST',
      targetId: requestId,
      detail: { decision, note: trimmedNote, teacherId: request.teacherId },
    })

    revalidatePath('/admin/teachers/info-change-requests')
    revalidatePath('/onboarding/complete')
    return { success: true as const }
  } catch (error) {
    console.error('资料修改申请初审失败:', error)
    return { success: false as const, error: '操作失败，请重试' }
  }
}

// 复审：仅运营/超管；通过后事务内写入 Teacher 生效
export async function finalReviewInfoChangeRequest(
  requestId: string,
  decision: 'APPROVED' | 'REJECTED',
  note?: string
) {
  try {
    const reviewer = await resolveReviewer()
    if (!reviewer) return { success: false as const, error: '无权限执行此操作' }
    if (reviewer.role === 'LEARNER_MANAGER') {
      return { success: false as const, error: '复审仅限运营或管理员执行' }
    }

    const request = await prisma.teacherInfoChangeRequest.findUnique({
      where: { id: requestId },
    })
    if (!request) return { success: false as const, error: '申请不存在' }
    if (request.status !== 'PENDING_FINAL_REVIEW') {
      return { success: false as const, error: '该申请不在待复审状态' }
    }

    // 初审与复审不可为同一人（超管越级除外）
    if (reviewer.role !== 'ADMIN' && request.firstReviewerId && request.firstReviewerId === reviewer.id) {
      return { success: false as const, error: '初审与复审不可为同一人，请由其他运营复审' }
    }

    const trimmedNote = note?.trim() || null
    if (decision === 'REJECTED' && !trimmedNote) {
      return { success: false as const, error: '驳回时必须填写原因' }
    }

    const changes = parseChanges(request.changes)
    // 生效前复核申请数据合法性（防提交后被篡改）
    for (const [field, change] of Object.entries(changes)) {
      if (!SENSITIVE_FIELD_SET.has(field)) {
        return { success: false as const, error: '申请包含非法字段' }
      }
      const invalid = validateSensitiveValue(field as SensitiveField, change.to)
      if (invalid) return { success: false as const, error: `申请数据异常：${invalid}` }
    }

    const teacherExists = await prisma.teacher.findUnique({
      where: { id: request.teacherId },
      select: { id: true },
    })
    if (!teacherExists) return { success: false as const, error: '老师不存在' }

    if (decision === 'REJECTED') {
      const result = await prisma.teacherInfoChangeRequest.updateMany({
        where: { id: requestId, status: 'PENDING_FINAL_REVIEW' },
        data: {
          status: 'REJECTED',
          finalReviewerId: reviewer.id,
          finalReviewerName: reviewer.name,
          finalReviewerRole: reviewer.role,
          finalReviewedAt: new Date(),
          finalReviewNote: trimmedNote,
        },
      })
      if (result.count !== 1) {
        return { success: false as const, error: '该申请已被处理，请刷新后重试' }
      }

      await recordAudit({
        actorType: reviewer.role === 'ADMIN' ? 'ADMIN' : 'OPERATOR',
        actorId: reviewer.id,
        actorName: reviewer.name,
        action: 'FINAL_REVIEW_INFO_CHANGE_REQUEST',
        targetType: 'TEACHER_INFO_CHANGE_REQUEST',
        targetId: requestId,
        detail: { decision, note: trimmedNote, teacherId: request.teacherId },
      })

      revalidatePath('/admin/teachers/info-change-requests')
      revalidatePath(`/admin/teachers/${request.teacherId}`)
      revalidatePath('/onboarding/complete')
      return { success: true as const }
    }

    // 复审通过：乐观锁抢占 + 事务内写入教师记录
    try {
      await prisma.$transaction(async (tx) => {
        const result = await tx.teacherInfoChangeRequest.updateMany({
          where: { id: requestId, status: 'PENDING_FINAL_REVIEW' },
          data: {
            status: 'APPROVED',
            finalReviewerId: reviewer.id,
            finalReviewerName: reviewer.name,
            finalReviewerRole: reviewer.role,
            finalReviewedAt: new Date(),
            finalReviewNote: trimmedNote,
            appliedAt: new Date(),
          },
        })
        if (result.count !== 1) throw new Error('CONCURRENT_REVIEW')

        const toValues = new Map(Object.entries(changes).map(([field, change]) => [field, change.to]))
        await tx.teacher.update({
          where: { id: request.teacherId },
          data: {
            ...(toValues.has('name') ? { name: toValues.get('name') as string } : {}),
            ...(toValues.has('gaokaoProvince') ? { gaokaoProvince: toValues.get('gaokaoProvince') as string } : {}),
            ...(toValues.has('mathScore') ? { mathScore: toValues.get('mathScore') as number } : {}),
            ...(toValues.has('physicsScore') ? { physicsScore: toValues.get('physicsScore') as number } : {}),
            ...(toValues.has('chemistryScore') ? { chemistryScore: toValues.get('chemistryScore') as number } : {}),
          },
        })
      })
    } catch (txError) {
      if (txError instanceof Error && txError.message === 'CONCURRENT_REVIEW') {
        return { success: false as const, error: '该申请已被处理，请刷新后重试' }
      }
      throw txError
    }

    // 生效审计：以 UPDATE_TEACHER_INFO 记录字段级 from → to（变更日志组件可直接展示），并关联申请单
    await recordAudit({
      actorType: reviewer.role === 'ADMIN' ? 'ADMIN' : 'OPERATOR',
      actorId: reviewer.id,
      actorName: reviewer.name,
      action: 'UPDATE_TEACHER_INFO',
      targetType: 'TEACHER',
      targetId: request.teacherId,
      detail: { changes, source: 'INFO_CHANGE_REQUEST', requestId },
    })
    await recordAudit({
      actorType: reviewer.role === 'ADMIN' ? 'ADMIN' : 'OPERATOR',
      actorId: reviewer.id,
      actorName: reviewer.name,
      action: 'FINAL_REVIEW_INFO_CHANGE_REQUEST',
      targetType: 'TEACHER_INFO_CHANGE_REQUEST',
      targetId: requestId,
      detail: { decision: 'APPROVED', note: trimmedNote, teacherId: request.teacherId },
    })

    revalidatePath('/admin/teachers/info-change-requests')
    revalidatePath(`/admin/teachers/${request.teacherId}`)
    revalidatePath('/onboarding/complete')
    revalidatePath('/onboarding')
    return { success: true as const }
  } catch (error) {
    console.error('资料修改申请复审失败:', error)
    return { success: false as const, error: '操作失败，请重试' }
  }
}

// 教练查询自己的申请记录（完成页展示）
export async function getMyInfoChangeRequests(): Promise<{
  success: boolean
  requests?: InfoChangeItemView[]
  error?: string
}> {
  try {
    const teacherId = (await cookies()).get('teacherId')?.value
    if (!teacherId) return { success: false, error: '请先登录' }

    const rows = await prisma.teacherInfoChangeRequest.findMany({
      where: { teacherId },
      orderBy: { createdAt: 'desc' },
      take: 20,
    })
    return { success: true, requests: rows.map(toInfoChangeItemView) }
  } catch (error) {
    console.error('查询资料修改申请失败:', error)
    return { success: false, error: '查询失败，请重试' }
  }
}
