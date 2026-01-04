'use server'

import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import { cookies } from 'next/headers'
import { ensureInviteCodes } from './teacher'

// 验证手机号格式
function isValidPhone(phone: string): boolean {
  return /^1[3-9]\d{9}$/.test(phone)
}

// 邀请人注册
export async function registerReferrer(formData: {
  name: string
  phone: string
  password: string
  confirmPassword: string
}) {
  try {
    const { name, phone, password, confirmPassword } = formData

    // 验证必填字段
    if (!name?.trim()) {
      return { success: false, error: '请输入姓名' }
    }
    if (!phone?.trim()) {
      return { success: false, error: '请输入手机号' }
    }
    if (!password) {
      return { success: false, error: '请输入密码' }
    }
    if (!confirmPassword) {
      return { success: false, error: '请确认密码' }
    }

    // 验证手机号格式
    if (!isValidPhone(phone)) {
      return { success: false, error: '手机号格式不正确' }
    }

    // 验证密码长度
    if (password.length < 6) {
      return { success: false, error: '密码至少需要6位' }
    }

    // 验证密码确认
    if (password !== confirmPassword) {
      return { success: false, error: '两次密码输入不一致' }
    }

    // 检查手机号是否已注册
    const existingTeacher = await prisma.teacher.findUnique({
      where: { phone }
    })

    if (existingTeacher) {
      return { success: false, error: '该手机号已被注册' }
    }

    // 加密密码
    const hashedPassword = await bcrypt.hash(password, 10)

    // 创建老师记录
    const teacher = await prisma.teacher.create({
      data: {
        name: name.trim(),
        phone: phone.trim(),
        password: hashedPassword,
        status: 'NOT_STARTED'
      }
    })

    // 生成邀请码和查看码
    await ensureInviteCodes(teacher.id)

    // 设置认证 cookie
    const cookieStore = await cookies()
    cookieStore.set('referrer_session', teacher.id, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30 // 30天
    })

    return {
      success: true,
      teacherId: teacher.id,
      message: '注册成功'
    }
  } catch (error) {
    console.error('注册失败:', error)
    return { success: false, error: '注册失败，请重试' }
  }
}

// 邀请人登录
export async function loginReferrer(formData: {
  phone: string
  password: string
}) {
  try {
    const { phone, password } = formData

    // 验证必填字段
    if (!phone?.trim()) {
      return { success: false, error: '请输入手机号' }
    }
    if (!password) {
      return { success: false, error: '请输入密码' }
    }

    // 验证手机号格式
    if (!isValidPhone(phone)) {
      return { success: false, error: '手机号格式不正确' }
    }

    // 查找用户
    const teacher = await prisma.teacher.findUnique({
      where: { phone: phone.trim() },
      select: {
        id: true,
        name: true,
        phone: true,
        password: true,
        inviteCode: true
      }
    })

    if (!teacher) {
      return { success: false, error: '手机号或密码错误' }
    }

    // 检查是否设置了密码（老用户可能没有密码）
    if (!teacher.password) {
      return { success: false, error: '该账号未设置密码，请联系管理员' }
    }

    // 验证密码
    const isPasswordValid = await bcrypt.compare(password, teacher.password)
    if (!isPasswordValid) {
      return { success: false, error: '手机号或密码错误' }
    }

    // 确保有邀请码
    if (!teacher.inviteCode) {
      await ensureInviteCodes(teacher.id)
    }

    // 设置认证 cookie
    const cookieStore = await cookies()
    cookieStore.set('referrer_session', teacher.id, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30 // 30天
    })

    return {
      success: true,
      teacherId: teacher.id,
      name: teacher.name,
      message: '登录成功'
    }
  } catch (error) {
    console.error('登录失败:', error)
    return { success: false, error: '登录失败，请重试' }
  }
}

// 邀请人登出
export async function logoutReferrer() {
  try {
    const cookieStore = await cookies()
    cookieStore.delete('referrer_session')

    return { success: true, message: '已退出登录' }
  } catch (error) {
    console.error('登出失败:', error)
    return { success: false, error: '登出失败，请重试' }
  }
}

// 获取当前登录的邀请人信息
export async function getCurrentReferrer() {
  try {
    const cookieStore = await cookies()
    const session = cookieStore.get('referrer_session')

    if (!session?.value) {
      return { success: false, error: '未登录' }
    }

    const teacher = await prisma.teacher.findUnique({
      where: { id: session.value },
      select: {
        id: true,
        name: true,
        phone: true,
        inviteCode: true
      }
    })

    if (!teacher) {
      // Cookie中的ID无效，清除cookie
      cookieStore.delete('referrer_session')
      return { success: false, error: '会话已过期' }
    }

    return { success: true, teacher }
  } catch (error) {
    console.error('获取当前用户失败:', error)
    return { success: false, error: '获取用户信息失败' }
  }
}
