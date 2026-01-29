import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import { cookies } from 'next/headers'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, phone, password, confirmPassword } = body

    // 验证必填字段
    if (!name?.trim()) {
      return NextResponse.json(
        { success: false, error: '请输入姓名' },
        { status: 400 }
      )
    }
    if (!phone?.trim()) {
      return NextResponse.json(
        { success: false, error: '请输入手机号' },
        { status: 400 }
      )
    }
    if (!password) {
      return NextResponse.json(
        { success: false, error: '请输入密码' },
        { status: 400 }
      )
    }
    if (!confirmPassword) {
      return NextResponse.json(
        { success: false, error: '请确认密码' },
        { status: 400 }
      )
    }

    // 验证手机号格式
    if (!/^1[3-9]\d{9}$/.test(phone)) {
      return NextResponse.json(
        { success: false, error: '手机号格式不正确' },
        { status: 400 }
      )
    }

    // 验证密码长度
    if (password.length < 6) {
      return NextResponse.json(
        { success: false, error: '密码至少需要6位' },
        { status: 400 }
      )
    }

    // 验证密码确认
    if (password !== confirmPassword) {
      return NextResponse.json(
        { success: false, error: '两次密码输入不一致' },
        { status: 400 }
      )
    }

    // 获取当前登录的 teacherId
    const cookieStore = await cookies()
    const teacherId = cookieStore.get('teacherId')?.value

    if (!teacherId) {
      return NextResponse.json(
        { success: false, error: '未登录' },
        { status: 401 }
      )
    }

    // 检查手机号是否已被其他用户使用
    const existingTeacher = await prisma.teacher.findUnique({
      where: { phone: phone.trim() }
    })

    if (existingTeacher && existingTeacher.id !== teacherId) {
      return NextResponse.json(
        { success: false, error: '该手机号已被注册' },
        { status: 400 }
      )
    }

    // 加密密码
    const hashedPassword = await bcrypt.hash(password, 10)

    // 更新老师信息
    const teacher = await prisma.teacher.update({
      where: { id: teacherId },
      data: {
        name: name.trim(),
        phone: phone.trim(),
        password: hashedPassword
      }
    })

    // 确保有邀请码
    const { ensureInviteCodes } = await import('@/app/actions/teacher')
    await ensureInviteCodes(teacher.id)

    return NextResponse.json({
      success: true,
      teacherId: teacher.id,
      message: '信息补充成功'
    })
  } catch (error) {
    console.error('补充信息API错误:', error)
    return NextResponse.json(
      { success: false, error: '服务器错误' },
      { status: 500 }
    )
  }
}
