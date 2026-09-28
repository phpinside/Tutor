import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { isSuperAdminRequest, getOperatorSessionInfo } from '@/lib/operatorAuth'
import { isTeacherInScope } from '@/lib/learnerManagerScope'
import { recordAudit } from '@/lib/auditLog'

/**
 * 揭示教练完整手机号。
 * 权限：超管任意；运营/学管仅限自己可见范围（白名单）内的教练。
 * 每次揭示均记录审计日志（谁/何时/看了哪位教练）。
 */
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const teacherId = body.teacherId as string | undefined

    if (!teacherId || typeof teacherId !== 'string') {
      return NextResponse.json({ error: '参数错误' }, { status: 400 })
    }

    let actorType: 'ADMIN' | 'OPERATOR'
    let actorId: string
    let actorName: string | null

    if (await isSuperAdminRequest()) {
      actorType = 'ADMIN'
      actorId = 'super_admin'
      actorName = '管理员'
    } else {
      const session = await getOperatorSessionInfo()
      if (!session) {
        return NextResponse.json({ error: '未授权' }, { status: 401 })
      }
      const operator = await prisma.operator.findUnique({
        where: { id: session.operatorId },
        select: { role: true, isEnabled: true },
      })
      if (!operator || !operator.isEnabled) {
        return NextResponse.json({ error: '未授权' }, { status: 401 })
      }
      const inScope = await isTeacherInScope(session.operatorId, teacherId)
      if (inScope === false) {
        return NextResponse.json({ error: '该老师不在你的可见范围内' }, { status: 403 })
      }
      actorType = 'OPERATOR'
      actorId = session.operatorId
      actorName = session.name
    }

    const teacher = await prisma.teacher.findUnique({
      where: { id: teacherId },
      select: { phone: true },
    })
    if (!teacher) {
      return NextResponse.json({ error: '未找到' }, { status: 404 })
    }

    await recordAudit({
      actorType,
      actorId,
      actorName,
      action: 'REVEAL_TEACHER_PHONE',
      targetType: 'TEACHER',
      targetId: teacherId,
    })

    return NextResponse.json({ phone: teacher.phone || '' })
  } catch {
    return NextResponse.json({ error: '请求失败' }, { status: 500 })
  }
}
