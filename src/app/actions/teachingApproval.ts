'use server'

import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import { recordAudit } from '@/lib/auditLog'
import { isSuperAdmin } from '@/lib/admin-auth'
import { getOperatorSessionInfo } from '@/lib/operatorAuth'
import {
  parseTeachingApprovalLevels,
  parseTeachingApprovalSubjects,
} from '@/lib/teachingApprovalShared'
import { TEACHING_APPROVAL_CODES, TEACHING_APPROVAL_SUBJECT_CODES } from '@/lib/teachingApprovalShared'

// 运营特批授课能力（学段 + 科目，可派单资格审查用）
// 权限：仅超管与运营（OPERATOR 角色）可设置；学管（LEARNER_MANAGER）可见但明确不可修改
// 可见性：数据存独立表，教练端页面/接口不读取（教练不可见）

// 设置特批授课学段与科目（两者均传空 = 清空特批）
export async function updateTeachingApproval(
  teacherId: string,
  levels: string[],
  subjects: string[]
): Promise<{ success: boolean; error?: string }> {
  try {
    // 鉴权：超管或运营（OPERATOR 角色）；学管一律拒绝（以 DB 角色为准）
    let actorType: 'ADMIN' | 'OPERATOR'
    let actorId: string
    let actorName: string | null

    if (await isSuperAdmin()) {
      actorType = 'ADMIN'
      actorId = 'super_admin'
      actorName = '管理员'
    } else {
      const session = await getOperatorSessionInfo()
      if (!session) return { success: false, error: '无权限执行此操作' }
      const operator = await prisma.operator.findUnique({
        where: { id: session.operatorId },
        select: { name: true, isEnabled: true, role: true },
      })
      if (!operator || !operator.isEnabled || operator.role !== 'OPERATOR') {
        return { success: false, error: '仅运营可设置特批授课能力，学管不可修改' }
      }
      actorType = 'OPERATOR'
      actorId = session.operatorId
      actorName = operator.name
    }

    // 校验：去重 + 过滤非法值 + 按选项顺序存储
    const providedLevels = Array.from(new Set((levels ?? []).map((l) => String(l).trim()).filter(Boolean)))
    if (providedLevels.some((l) => !TEACHING_APPROVAL_CODES.includes(l))) {
      return { success: false, error: '包含不支持的授课学段选项' }
    }
    const providedSubjects = Array.from(
      new Set((subjects ?? []).map((s) => String(s).trim()).filter(Boolean))
    )
    if (providedSubjects.some((s) => !TEACHING_APPROVAL_SUBJECT_CODES.includes(s))) {
      return { success: false, error: '包含不支持的授课科目选项' }
    }
    const normalizedLevels = parseTeachingApprovalLevels(providedLevels.join(','))
    const normalizedSubjects = parseTeachingApprovalSubjects(providedSubjects.join(','))

    const teacher = await prisma.teacher.findUnique({
      where: { id: teacherId },
      select: { name: true },
    })
    if (!teacher) return { success: false, error: '老师不存在' }

    const previous = await prisma.teacherTeachingApproval.findUnique({
      where: { teacherId },
      select: { levels: true, subjects: true },
    })

    if (normalizedLevels.length === 0 && normalizedSubjects.length === 0) {
      // 双维度均清空：删除记录（未设置过则幂等跳过）
      await prisma.teacherTeachingApproval.deleteMany({ where: { teacherId } })
    } else {
      await prisma.teacherTeachingApproval.upsert({
        where: { teacherId },
        create: {
          teacherId,
          levels: normalizedLevels.join(','),
          subjects: normalizedSubjects.join(','),
          updatedById: actorId,
          updatedByName: actorName,
        },
        update: {
          levels: normalizedLevels.join(','),
          subjects: normalizedSubjects.join(','),
          updatedById: actorId,
          updatedByName: actorName,
        },
      })
    }

    await recordAudit({
      actorType,
      actorId,
      actorName,
      action: 'UPDATE_TEACHING_APPROVAL',
      targetType: 'TEACHER',
      targetId: teacherId,
      detail: {
        levels: normalizedLevels,
        subjects: normalizedSubjects,
        previousLevels: previous ? parseTeachingApprovalLevels(previous.levels) : [],
        previousSubjects: previous ? parseTeachingApprovalSubjects(previous.subjects) : [],
      },
    })

    revalidatePath(`/admin/teachers/${teacherId}`)
    return { success: true }
  } catch (error) {
    console.error('设置特批授课能力失败:', error)
    return { success: false, error: '操作失败，请重试' }
  }
}
