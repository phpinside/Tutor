'use server'

import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import { cookies } from 'next/headers'
import { ensureInviteCodes, createReferralRecord } from './teacher'

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
  referralCode?: string
  subjects?: string[]
  primarySubject?: string
}) {
  try {
    const { name, phone, password, confirmPassword, referralCode, subjects, primarySubject } = formData

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

    // 查找邀请人（如果提供了邀请码）
    let invitedById: string | null = null
    let inviterDefaultFollowUpId: string | null = null
    if (referralCode?.trim()) {
      const referrer = await prisma.teacher.findUnique({
        where: { inviteCode: referralCode.trim().toUpperCase() },
        select: { id: true, defaultInviteeFollowUpId: true }
      })
      
      if (!referrer) {
        return { success: false, error: '邀请码无效' }
      }
      
      invitedById = referrer.id
      inviterDefaultFollowUpId = referrer.defaultInviteeFollowUpId
    }

    // 检查手机号是否已注册
    const existingTeacher = await prisma.teacher.findUnique({
      where: { phone: phone.trim() }
    })

    if (existingTeacher) {
      // 如果已经设置了密码，说明已经注册过邀请人
      if (existingTeacher.password) {
        return { success: false, error: '该手机号已注册为邀请人，请直接登录' }
      }
      
      // 如果没有密码，说明是通过引导系统创建的，升级为邀请人
      const hashedPassword = await bcrypt.hash(password, 10)
      
      const teacher = await prisma.teacher.update({
        where: { id: existingTeacher.id },
        data: {
          name: name.trim(),
          password: hashedPassword,
          // 如果提供了新的邀请码且当前没有邀请人，更新邀请关系
          ...(invitedById && !existingTeacher.invitedById ? { invitedById } : {})
        }
      })
      
      // 生成邀请码
      await ensureInviteCodes(teacher.id)
      
      // 如果建立了新的邀请关系，创建邀请记录并自动归属跟进人
      if (invitedById && !existingTeacher.invitedById) {
        await createReferralRecord(invitedById, teacher.id)
        if (inviterDefaultFollowUpId) {
          await prisma.teacherTeam.createMany({
            data: [{ teacherId: teacher.id, operatorId: inviterDefaultFollowUpId }],
            skipDuplicates: true,
          })
        }
      }
      
      // 设置认证 cookie（统一使用 teacherId）
      const cookieStore = await cookies()
      cookieStore.set('teacherId', teacher.id, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 365 // 365天
      })

      return {
        success: true,
        teacherId: teacher.id,
        message: '注册成功'
      }
    }

    // 加密密码
    const hashedPassword = await bcrypt.hash(password, 10)

    // 创建新的老师记录
    const teacher = await prisma.teacher.create({
      data: {
        name: name.trim(),
        phone: phone.trim(),
        password: hashedPassword,
        status: 'NOT_STARTED',
        invitedById,
        subjects: subjects ?? [],
        primarySubject: primarySubject ?? null
      }
    })

    // 生成邀请码
    await ensureInviteCodes(teacher.id)
    
    // 如果有邀请人，创建邀请记录并自动归属跟进人
    if (invitedById) {
      await createReferralRecord(invitedById, teacher.id)
      if (inviterDefaultFollowUpId) {
        await prisma.teacherTeam.createMany({
          data: [{ teacherId: teacher.id, operatorId: inviterDefaultFollowUpId }],
          skipDuplicates: true,
        })
      }
    }

    // 设置认证 cookie（统一使用 teacherId）
    const cookieStore = await cookies()
    cookieStore.set('teacherId', teacher.id, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 365 // 365天
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

    // 设置认证 cookie（统一使用 teacherId）
    const cookieStore = await cookies()
    cookieStore.set('teacherId', teacher.id, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 365 // 365天
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

// 邀请人登出（统一使用 teacherId）
export async function logoutReferrer() {
  try {
    const cookieStore = await cookies()
    cookieStore.delete('teacherId')

    return { success: true, message: '已退出登录' }
  } catch (error) {
    console.error('登出失败:', error)
    return { success: false, error: '登出失败，请重试' }
  }
}

// 获取当前登录的邀请人信息（统一使用 teacherId）
export async function getCurrentReferrer() {
  try {
    const cookieStore = await cookies()
    const teacherId = cookieStore.get('teacherId')?.value

    if (!teacherId) {
      return { success: false, error: '未登录' }
    }

    const teacher = await prisma.teacher.findUnique({
      where: { id: teacherId },
      select: {
        id: true,
        name: true,
        phone: true,
        inviteCode: true
      }
    })

    if (!teacher) {
      return { success: false, error: '会话已过期' }
    }

    return { success: true, teacher }
  } catch (error) {
    console.error('获取当前用户失败:', error)
    return { success: false, error: '获取用户信息失败' }
  }
}

// 老师注册（用于新用户注册）
export async function registerTeacher(formData: {
  name: string
  phone: string
  password: string
  confirmPassword: string
  referralCode?: string
}) {
  try {
    const { name, phone, password, confirmPassword, referralCode } = formData

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

    // 查找邀请人（如果提供了邀请码）
    let invitedById: string | null = null
    let inviterDefaultFollowUpId: string | null = null
    if (referralCode?.trim()) {
      const referrer = await prisma.teacher.findUnique({
        where: { inviteCode: referralCode.trim().toUpperCase() },
        select: { id: true, defaultInviteeFollowUpId: true }
      })
      
      if (!referrer) {
        return { success: false, error: '邀请码无效' }
      }
      
      invitedById = referrer.id
      inviterDefaultFollowUpId = referrer.defaultInviteeFollowUpId
    }

    // 检查手机号是否已注册
    const existingTeacher = await prisma.teacher.findUnique({
      where: { phone: phone.trim() }
    })

    if (existingTeacher) {
      // 如果已经设置了密码，说明已经注册过
      if (existingTeacher.password) {
        return { success: false, error: '该手机号已注册，请直接登录' }
      }
      
      // 如果没有密码，说明是通过引导系统创建的老用户，升级账号
      const hashedPassword = await bcrypt.hash(password, 10)
      
      const teacher = await prisma.teacher.update({
        where: { id: existingTeacher.id },
        data: {
          name: name.trim(),
          password: hashedPassword,
          // 如果提供了新的邀请码且当前没有邀请人，更新邀请关系
          ...(invitedById && !existingTeacher.invitedById ? { invitedById } : {})
        }
      })
      
      // 生成邀请码
      await ensureInviteCodes(teacher.id)
      
      // 如果建立了新的邀请关系，创建邀请记录并自动归属跟进人
      if (invitedById && !existingTeacher.invitedById) {
        await createReferralRecord(invitedById, teacher.id)
        if (inviterDefaultFollowUpId) {
          await prisma.teacherTeam.createMany({
            data: [{ teacherId: teacher.id, operatorId: inviterDefaultFollowUpId }],
            skipDuplicates: true,
          })
        }
      }
      
      // 设置认证 cookie
      const cookieStore = await cookies()
      cookieStore.set('teacherId', teacher.id, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 365 // 1年
      })

      return {
        success: true,
        teacherId: teacher.id,
        message: '注册成功'
      }
    }

    // 加密密码
    const hashedPassword = await bcrypt.hash(password, 10)

    // 创建新的老师记录
    const teacher = await prisma.teacher.create({
      data: {
        name: name.trim(),
        phone: phone.trim(),
        password: hashedPassword,
        status: 'NOT_STARTED',
        invitedById
      }
    })

    // 生成邀请码
    await ensureInviteCodes(teacher.id)
    
    // 如果有邀请人，创建邀请记录并自动归属跟进人
    if (invitedById) {
      await createReferralRecord(invitedById, teacher.id)
      if (inviterDefaultFollowUpId) {
        await prisma.teacherTeam.createMany({
          data: [{ teacherId: teacher.id, operatorId: inviterDefaultFollowUpId }],
          skipDuplicates: true,
        })
      }
    }

    // 设置认证 cookie
    const cookieStore = await cookies()
    cookieStore.set('teacherId', teacher.id, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 365 // 1年
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

// 老师登录（用于引导流程）
export async function loginTeacher(phone: string, password: string) {
  try {
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

    // 检查是否设置了密码
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
      const { ensureInviteCodes } = await import('./teacher')
      await ensureInviteCodes(teacher.id)
    }

    // 设置认证 cookie
    const cookieStore = await cookies()
    cookieStore.set('teacherId', teacher.id, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 365 // 1年
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

// 老师登出
export async function logoutTeacher() {
  try {
    const cookieStore = await cookies()
    cookieStore.delete('teacherId')

    return { success: true, message: '已退出登录' }
  } catch (error) {
    console.error('登出失败:', error)
    return { success: false, error: '登出失败，请重试' }
  }
}
