import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import { verifyAdminCredentials } from '@/lib/adminAuth'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const teacherId = body.teacherId as string | undefined
    const password = body.password as string | undefined
    const username = body.username as string | undefined

    if (!teacherId || typeof teacherId !== 'string') {
      return NextResponse.json({ error: '参数错误' }, { status: 400 })
    }

    const cookieStore = await cookies()
    const operatorSession = cookieStore.get('operator_session')
    const adminSession = cookieStore.get('admin_session')

    if (operatorSession) {
      let operatorId: string | null = null
      try {
        const data = JSON.parse(operatorSession.value)
        if (data.operatorId) operatorId = data.operatorId as string
      } catch {
        return NextResponse.json({ error: '未授权' }, { status: 401 })
      }
      if (!operatorId) {
        return NextResponse.json({ error: '未授权' }, { status: 401 })
      }
      if (!password || typeof password !== 'string') {
        return NextResponse.json({ error: '请输入密码' }, { status: 400 })
      }
      const operator = await prisma.operator.findUnique({
        where: { id: operatorId },
      })
      if (!operator || !operator.isEnabled) {
        return NextResponse.json({ error: '未授权' }, { status: 401 })
      }
      const match = await bcrypt.compare(password, operator.password)
      if (!match) {
        return NextResponse.json({ error: '密码错误' }, { status: 401 })
      }
      const teacher = await prisma.teacher.findUnique({
        where: { id: teacherId },
        select: { phone: true },
      })
      if (!teacher) {
        return NextResponse.json({ error: '未找到' }, { status: 404 })
      }
      return NextResponse.json({ phone: teacher.phone || '' })
    }

    if (adminSession) {
      try {
        JSON.parse(adminSession.value)
      } catch {
        return NextResponse.json({ error: '未授权' }, { status: 401 })
      }
      if (!username || !password) {
        return NextResponse.json({ error: '请输入账号与密码' }, { status: 400 })
      }
      const account = verifyAdminCredentials(username, password)
      if (!account) {
        return NextResponse.json({ error: '账号或密码错误' }, { status: 401 })
      }
      const teacher = await prisma.teacher.findUnique({
        where: { id: teacherId },
        select: { phone: true },
      })
      if (!teacher) {
        return NextResponse.json({ error: '未找到' }, { status: 404 })
      }
      return NextResponse.json({ phone: teacher.phone || '' })
    }

    return NextResponse.json({ error: '未授权' }, { status: 401 })
  } catch {
    return NextResponse.json({ error: '请求失败' }, { status: 500 })
  }
}
