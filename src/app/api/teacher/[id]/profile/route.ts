import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import {
  parseTeachingApprovalLevels,
  parseTeachingApprovalSubjects,
} from '@/lib/teachingApprovalShared'

// 供外部服务调用的教练属性信息查询接口（风格与 /api/teacher/[id] 一致）
// 根据教练唯一 ID 返回其各项属性信息（基础资料 / 高考成绩与总分 / 资质申报 / 特批授课能力等）
// 注意：不返回密码等敏感凭据；特批授课能力仅供服务端派单资格审查使用，请勿透出给教练端

function splitCsv(value: string | null): string[] {
  if (!value) return []
  return value
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean)
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const teacherId = id.trim()

    const teacher = await prisma.teacher.findUnique({
      where: { id: teacherId },
      select: {
        // 基础信息
        id: true,
        name: true,
        phone: true,
        gender: true,
        age: true,
        school: true,
        graduationYear: true,
        identity: true,
        // 高考信息（成绩 + 卷面总分）
        gaokaoProvince: true,
        mathScore: true,
        mathScoreTotal: true,
        physicsScore: true,
        physicsScoreTotal: true,
        chemistryScore: true,
        chemistryScoreTotal: true,
        // 学科信息
        subjects: true,
        primarySubject: true,
        // 教学能力 & 资质
        scienceCompetition: true,
        teachingExperience: true,
        gradePreference: true,
        teachingStrengths: true,
        teachingStyle: true,
        studentTypes: true,
        weekdayTime: true,
        weekendTime: true,
        holidayTime: true,
        // 资质申报专项字段（供其它服务直接读取）
        hasTeacherCert: true,
        teacherCertStage: true,
        teacherCertSubject: true,
        mandarinLevel: true,
        hasDegreeCert: true,
        isInServiceTeacher: true,
        // 状态
        status: true,
        currentTaskIndex: true,
        teachingStatus: true,
        createdAt: true,
        updatedAt: true,
        // 入驻审核阶段
        coachReview: {
          select: { stage: true },
        },
        // 运营特批授课能力（可派单资格审查）
        teachingApproval: {
          select: {
            levels: true,
            subjects: true,
            updatedByName: true,
            updatedAt: true,
          },
        },
        // 归属学管（团队认领人）
        teamAssignment: {
          select: { operator: { select: { name: true } } },
        },
      },
    })

    if (!teacher) {
      return NextResponse.json(
        { success: false, error: '教练不存在' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      data: {
        // 基础信息
        id: teacher.id,
        name: teacher.name,
        phone: teacher.phone,
        gender: teacher.gender,
        age: teacher.age,
        school: teacher.school,
        graduationYear: teacher.graduationYear,
        identity: teacher.identity,
        // 高考信息（成绩与卷面总分成对返回，null 表示未填写）
        gaokaoProvince: teacher.gaokaoProvince,
        scores: {
          math: teacher.mathScore,
          mathTotal: teacher.mathScoreTotal,
          physics: teacher.physicsScore,
          physicsTotal: teacher.physicsScoreTotal,
          chemistry: teacher.chemistryScore,
          chemistryTotal: teacher.chemistryScoreTotal,
        },
        // 学科信息
        subjects: teacher.subjects ?? [],
        primarySubject: teacher.primarySubject,
        // 教学能力 & 资质
        scienceCompetition: teacher.scienceCompetition,
        teachingExperience: teacher.teachingExperience,
        gradeLevels: splitCsv(teacher.gradePreference),
        teachingStrengths: splitCsv(teacher.teachingStrengths),
        teachingStyle: teacher.teachingStyle,
        studentTypes: splitCsv(teacher.studentTypes),
        availableTime: {
          weekday: teacher.weekdayTime,
          weekend: teacher.weekendTime,
          holiday: teacher.holidayTime,
        },
        // 资质申报专项字段（教练申报口径，随入驻审核把关）
        qualifications: {
          hasTeacherCert: teacher.hasTeacherCert,
          teacherCertStage: teacher.teacherCertStage, // PRIMARY / JUNIOR / SENIOR
          teacherCertSubject: teacher.teacherCertSubject, // MATH / PHYSICS / CHEMISTRY / OTHER
          mandarinLevel: teacher.mandarinLevel,
          hasDegreeCert: teacher.hasDegreeCert,
          isInServiceTeacher: teacher.isInServiceTeacher,
        },
        // 运营特批授课能力（可派单资格审查；教练不可见）
        teachingApproval: teacher.teachingApproval
          ? {
              levels: parseTeachingApprovalLevels(teacher.teachingApproval.levels),
              subjects: parseTeachingApprovalSubjects(teacher.teachingApproval.subjects),
              updatedByName: teacher.teachingApproval.updatedByName,
              updatedAt: teacher.teachingApproval.updatedAt,
            }
          : { levels: [], subjects: [], updatedByName: null, updatedAt: null },
        // 状态
        status: teacher.status, // NOT_STARTED / IN_PROGRESS / PENDING_REVIEW / COMPLETED / UNLOCKED
        reviewStage: teacher.coachReview?.stage ?? null, // FIRST_REVIEW / FINAL_REVIEW / CHALLENGED / APPROVED / REJECTED / PERMANENTLY_REJECTED
        teachingStatus: teacher.teachingStatus, // NOT_TAUGHT / TAUGHT
        managerName: teacher.teamAssignment?.operator.name ?? null,
        createdAt: teacher.createdAt,
        updatedAt: teacher.updatedAt,
      },
    })
  } catch (error) {
    console.error('查询教练属性信息失败:', error)
    return NextResponse.json(
      { success: false, error: '服务器错误' },
      { status: 500 }
    )
  }
}
