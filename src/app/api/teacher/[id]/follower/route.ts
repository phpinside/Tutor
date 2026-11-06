import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { recordAudit } from '@/lib/auditLog'
import { checkRateLimit, getClientIpFromForwarded } from '@/lib/rateLimit'

// 供外部服务调用的教练跟进人更新接口（风格与 /api/teacher/[id] 一致）
// 功能：传入教练 ID 与其当前学管信息（手机号或学管 ID），更新该教练的跟进人
// 约束：跟进人必须是启用状态的学管（LEARNER_MANAGER）角色
// 安全：生产环境请配置 EXTERNAL_API_TOKEN，调用时携带 x-api-token 请求头；未配置时放行（仅限内网/联调）

const MAX_BODY_LENGTH = 500

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const teacherId = id.trim()

    // 共享密钥校验（配置了 EXTERNAL_API_TOKEN 时强制）
    const expectedToken = process.env.EXTERNAL_API_TOKEN
    if (expectedToken) {
      const provided = request.headers.get('x-api-token')
      if (provided !== expectedToken) {
        return NextResponse.json(
          { success: false, error: '鉴权失败' },
          { status: 401 }
        )
      }
    }

    // 简易限流：单 IP 每分钟 20 次
    const ip = getClientIpFromForwarded(request.headers.get('x-forwarded-for'))
    const rate = checkRateLimit(`follower-api:${ip}`, 20, 60_000)
    if (!rate.allowed) {
      return NextResponse.json(
        { success: false, error: '请求过于频繁，请稍后重试' },
        { status: 429, headers: { 'Retry-After': String(rate.retryAfterSec) } }
      )
    }

    // 参数解析
    const raw = await request.text()
    if (!raw || raw.length > MAX_BODY_LENGTH) {
      return NextResponse.json(
        { success: false, error: '请求体无效' },
        { status: 400 }
      )
    }
    let body: { operatorPhone?: unknown; operatorId?: unknown }
    try {
      body = JSON.parse(raw)
    } catch {
      return NextResponse.json(
        { success: false, error: '请求体必须为 JSON' },
        { status: 400 }
      )
    }

    const operatorPhone = typeof body.operatorPhone === 'string' ? body.operatorPhone.trim() : ''
    const operatorIdInput = typeof body.operatorId === 'string' ? body.operatorId.trim() : ''
    if (!operatorPhone && !operatorIdInput) {
      return NextResponse.json(
        { success: false, error: '请提供 operatorPhone（学管手机号）或 operatorId（学管 ID）之一' },
        { status: 400 }
      )
    }

    // 教练存在性校验
    const teacher = await prisma.teacher.findUnique({
      where: { id: teacherId },
      select: { id: true, name: true },
    })
    if (!teacher) {
      return NextResponse.json(
        { success: false, error: '教练不存在' },
        { status: 404 }
      )
    }

    // 学管解析与校验：必须存在、启用、且为 LEARNER_MANAGER 角色（跟进人一定是学管）
    const operator = operatorPhone
      ? await prisma.operator.findUnique({
          where: { phone: operatorPhone },
          select: { id: true, name: true, phone: true, isEnabled: true, role: true },
        })
      : await prisma.operator.findUnique({
          where: { id: operatorIdInput },
          select: { id: true, name: true, phone: true, isEnabled: true, role: true },
        })

    if (!operator) {
      return NextResponse.json(
        { success: false, error: '学管不存在' },
        { status: 404 }
      )
    }
    if (!operator.isEnabled) {
      return NextResponse.json(
        { success: false, error: '该学管已停用，无法设为跟进人' },
        { status: 400 }
      )
    }
    if (operator.role !== 'LEARNER_MANAGER') {
      return NextResponse.json(
        { success: false, error: '跟进人必须是学管（LEARNER_MANAGER）角色' },
        { status: 400 }
      )
    }

    // 更新跟进人（teacherTeam 1:1 归属关系）
    await prisma.teacherTeam.upsert({
      where: { teacherId },
      update: { operatorId: operator.id },
      create: { teacherId, operatorId: operator.id },
    })

    // 审计留痕（外部来源，actor 记为 SYSTEM）
    await recordAudit({
      actorType: 'SYSTEM',
      actorId: 'external_api',
      actorName: '外部服务接口',
      action: 'UPDATE_TEACHER_FOLLOWER',
      targetType: 'TEACHER',
      targetId: teacherId,
      detail: {
        source: 'EXTERNAL_API',
        operatorId: operator.id,
        operatorName: operator.name,
        operatorPhone: operator.phone,
        teacherName: teacher.name,
      },
    })

    return NextResponse.json({
      success: true,
      data: {
        teacherId: teacher.id,
        teacherName: teacher.name,
        follower: {
          operatorId: operator.id,
          name: operator.name,
          phone: operator.phone,
          role: operator.role,
        },
      },
    })
  } catch (error) {
    console.error('更新教练跟进人失败:', error)
    return NextResponse.json(
      { success: false, error: '服务器错误' },
      { status: 500 }
    )
  }
}
