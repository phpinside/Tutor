'use server'

import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import { getSystemConfig as getSystemConfigFromDB } from './systemConfig'
import bcrypt from 'bcryptjs'
import { cookies } from 'next/headers'

// 获取老师信息
export async function getTeacher(teacherId: string) {
  try {
    const teacher = await prisma.teacher.findUnique({
      where: { id: teacherId },
      include: {
        taskSubmissions: {
          orderBy: { taskIndex: 'asc' }
        },
        teamAssignment: {
          include: {
            operator: {
              select: {
                id: true,
                name: true,
                wechatQrCode: true
              }
            }
          }
        }
      }
    })
    
    if (!teacher) {
      throw new Error('老师不存在')
    }
    
    return teacher
  } catch (error) {
    console.error('获取老师失败:', error)
    throw new Error('操作失败,请重试')
  }
}

// 验证手机号格式
function isValidPhone(phone: string): boolean {
  return /^1[3-9]\d{9}$/.test(phone)
}

// 注册并创建老师（用于匿名用户在任务1注册）
export async function registerAndCreateTeacher(formData: {
  phone: string
  password: string
  confirmPassword: string
  referralCode?: string
  // 基础信息
  name: string
  gender: string
  age: number
  school: string
  graduationYear?: string
  identity: string
  // 教学能力 & 资质
  mathScore: number
  mathCompetition?: string
  teachingExperience?: string
  gradePreference: string
  teachingStrengths?: string
  teachingStyle?: string
  studentTypes?: string
  // 可辅导时间
  weekdayTime?: string
  weekendTime?: string
  holidayTime?: string
}) {
  try {
    const { phone, password, confirmPassword, referralCode, ...teacherInfo } = formData

    // 验证必填字段
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
      where: { phone: phone.trim() }
    })

    if (existingTeacher) {
      return { success: false, error: '该手机号已被注册，请直接登录' }
    }

    // 查找邀请人
    let invitedById: string | null = null
    if (referralCode) {
      const referrer = await prisma.teacher.findUnique({
        where: { inviteCode: referralCode },
        select: { id: true }
      })
      if (referrer) {
        invitedById = referrer.id
      }
    }

    if (
      !Number.isInteger(teacherInfo.age) ||
      teacherInfo.age < 18 ||
      teacherInfo.age > 60
    ) {
      return { success: false, error: '年龄需在 18–60 之间的整数' }
    }

    // 加密密码
    const hashedPassword = await bcrypt.hash(password, 10)

    // 创建老师记录，包含所有基本信息
    const teacher = await prisma.teacher.create({
      data: {
        phone: phone.trim(),
        password: hashedPassword,
        invitedById,
        status: 'NOT_STARTED',
        currentTaskIndex: 1, // 已完成任务0，当前在任务1
        ...teacherInfo
      }
    })

    // 生成邀请码和查看码
    await ensureInviteCodes(teacher.id)

    // 如果有邀请人，创建邀请记录
    if (invitedById) {
      await createReferralRecord(invitedById, teacher.id)
    }

    // 提交任务1（标记为已完成）
    await prisma.taskSubmission.create({
      data: {
        teacherId: teacher.id,
        taskIndex: 1,
        taskType: 'FORM', // Task 1 is a FORM type
        status: 'COMPLETED',
        formData: teacherInfo as any
      }
    })

    // 更新当前任务索引到2
    await prisma.teacher.update({
      where: { id: teacher.id },
      data: { currentTaskIndex: 2 }
    })

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

// 更新老师基本信息
export async function updateTeacherInfo(teacherId: string, data: {
  // 基础信息
  name?: string
  phone?: string
  gender?: string
  age?: number
  school?: string
  graduationYear?: string
  identity?: string
  
  // 教学能力 & 资质
  mathScore?: number
  mathCompetition?: string
  teachingExperience?: string
  gradePreference?: string
  teachingStrengths?: string
  teachingStyle?: string
  studentTypes?: string
  
  // 可辅导时间
  weekdayTime?: string
  weekendTime?: string
  holidayTime?: string
}) {
  try {
    const teacher = await prisma.teacher.update({
      where: { id: teacherId },
      data
    })
    
    revalidatePath('/onboarding')
    return { success: true, teacher }
  } catch (error) {
    console.error('更新老师信息失败:', error)
    return { success: false, error: '更新失败,请重试' }
  }
}

// 更新老师状态
export async function updateTeacherStatus(teacherId: string, status: string) {
  try {
    const teacher = await prisma.teacher.update({
      where: { id: teacherId },
      data: { 
        status: status as any,
        updatedAt: new Date()
      }
    })
    
    revalidatePath('/onboarding')
    return { success: true, teacher }
  } catch (error) {
    console.error('更新老师状态失败:', error)
    return { success: false, error: '更新失败,请重试' }
  }
}

// 更新当前任务进度
export async function updateCurrentTask(teacherId: string, taskIndex: number) {
  try {
    // 总共6个任务(索引0-5)，当taskIndex为6时表示全部完成
    const TOTAL_TASKS = 6
    const isCompleted = taskIndex >= TOTAL_TASKS
    
    const teacher = await prisma.teacher.update({
      where: { id: teacherId },
      data: {
        currentTaskIndex: taskIndex,
        status: isCompleted ? 'COMPLETED' : 'IN_PROGRESS'
      }
    })
    
    revalidatePath('/onboarding')
    revalidatePath('/onboarding/complete')
    return { success: true, teacher }
  } catch (error) {
    console.error('更新任务进度失败:', error)
    return { success: false, error: '更新失败,请重试' }
  }
}

// ==================== 邀请相关功能 ====================

// 生成随机邀请码
function generateRandomCode(prefix: string, length: number): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // 去掉易混淆字符 I, O, 0, 1
  let code = prefix
  for (let i = 0; i < length; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return code
}

// 为老师生成邀请码（如果还没有）
export async function ensureInviteCodes(teacherId: string) {
  try {
    const teacher = await prisma.teacher.findUnique({
      where: { id: teacherId },
      select: { inviteCode: true }
    })
    
    if (!teacher) {
      throw new Error('老师不存在')
    }
    
    // 如果已有邀请码，直接返回
    if (teacher.inviteCode) {
      return {
        success: true,
        inviteCode: teacher.inviteCode
      }
    }
    
    // 生成唯一的邀请码
    let inviteCode = teacher.inviteCode
    
    // 生成邀请码
    if (!inviteCode) {
      let attempts = 0
      while (!inviteCode && attempts < 10) {
        const candidate = generateRandomCode('TUT-', 6)
        const existing = await prisma.teacher.findUnique({
          where: { inviteCode: candidate }
        })
        if (!existing) {
          inviteCode = candidate
        }
        attempts++
      }
      if (!inviteCode) {
        throw new Error('生成邀请码失败，请重试')
      }
    }
    
    // 更新数据库
    await prisma.teacher.update({
      where: { id: teacherId },
      data: {
        inviteCode
      }
    })
    
    return {
      success: true,
      inviteCode
    }
  } catch (error) {
    console.error('生成邀请码失败:', error)
    return { 
      success: false, 
      error: error instanceof Error ? error.message : '生成邀请码失败，请重试' 
    }
  }
}

// 通过邀请码获取邀请人信息（用于被邀请人注册）
export async function getTeacherByInviteCode(inviteCode: string) {
  try {
    const teacher = await prisma.teacher.findUnique({
      where: { inviteCode },
      select: {
        id: true,
        name: true,
        inviteCode: true
      }
    })
    
    return { success: true, teacher }
  } catch (error) {
    console.error('获取邀请人信息失败:', error)
    return { success: false, error: '邀请码无效' }
  }
}

// 通过teacherId获取邀请统计和列表（用于邀请看板 - 登录后使用）
export async function getReferralDataByTeacherId(
  teacherId: string,
  filters?: {
    page?: number
    pageSize?: number
    startDate?: string
    endDate?: string
    taskStatus?: string // '0' - '6' 表示任务进度
    referralStatus?: string // 邀请状态: 'PENDING' | 'VALID' | 'INVALID'
    rewardStatus?: string // 奖励状态: 'sent' | 'pending'
  }
) {
  try {
    const teacher = await prisma.teacher.findUnique({
      where: { id: teacherId },
      select: {
        id: true,
        name: true,
        inviteCode: true
      }
    })
    
    if (!teacher) {
      return { success: false, error: '用户不存在' }
    }

    // 构建查询条件
    const whereConditions: any = {
      referrerId: teacher.id
    }

    // 被邀请人筛选条件
    const referredWhere: any = {}

    // 时间范围筛选
    if (filters?.startDate || filters?.endDate) {
      const dateFilter: any = {}
      if (filters.startDate) {
        dateFilter.gte = new Date(filters.startDate)
      }
      if (filters.endDate) {
        const endDateTime = new Date(filters.endDate)
        endDateTime.setHours(23, 59, 59, 999)
        dateFilter.lte = endDateTime
      }
      whereConditions.createdAt = dateFilter
    }

    // 任务状态筛选
    if (filters?.taskStatus !== undefined && filters.taskStatus !== '') {
      referredWhere.currentTaskIndex = parseInt(filters.taskStatus)
    }

    // 邀请状态筛选
    if (filters?.referralStatus && filters.referralStatus !== '') {
      whereConditions.status = filters.referralStatus
    }

    // 奖励状态筛选
    if (filters?.rewardStatus && filters.rewardStatus !== '') {
      if (filters.rewardStatus === 'sent') {
        whereConditions.rewardSent = true
      } else if (filters.rewardStatus === 'pending') {
        whereConditions.rewardSent = false
        whereConditions.status = 'VALID' // 只有有效邀请才有待发放的概念
      }
    }

    // 如果有被邀请人筛选条件，添加到主查询
    if (Object.keys(referredWhere).length > 0) {
      whereConditions.referred = referredWhere
    }

    // 计算总数（用于统计和分页）
    const totalCount = await prisma.referral.count({
      where: whereConditions
    })

    // 获取全部数据用于统计
    const allReferrals = await prisma.referral.findMany({
      where: { referrerId: teacher.id },
      include: {
        referred: {
          select: {
            status: true
          }
        }
      }
    })

    // 计算收益统计
    const earningsResult = await calculateReferralEarnings(teacher.id)
    const earnings = earningsResult.success ? earningsResult.earnings : {
      directValid: 0,
      indirectValid: 0,
      directTaught: 0,
      indirectTaught: 0,
      directReward: 10,
      indirectReward: 5,
      directTeachingReward: 100,
      indirectTeachingReward: 20,
      totalEarnings: 0,
      totalWithdrawn: 0,
      totalPending: 0,
      availableBalance: 0
    }

    // 获取统计数据（从 ReferralStats 表）
    const referralStats = await prisma.referralStats.findUnique({
      where: { teacherId: teacher.id }
    })

    // 计算统计数据
    const stats = {
      directTotal: referralStats?.directTotal || 0,
      directValid: referralStats?.directValid || 0,
      directTaught: referralStats?.directTaught || 0,
      indirectTotal: referralStats?.indirectTotal || 0,
      indirectValid: referralStats?.indirectValid || 0,
      indirectTaught: referralStats?.indirectTaught || 0,
      directReward: earnings!.directReward,
      indirectReward: earnings!.indirectReward,
      directTeachingReward: earnings!.directTeachingReward,
      indirectTeachingReward: earnings!.indirectTeachingReward,
      totalEarnings: earnings!.totalEarnings,
      totalWithdrawn: earnings!.totalWithdrawn,
      totalPending: earnings!.totalPending,
      availableBalance: earnings!.availableBalance
    }

    // 获取直接邀请列表（应用筛选条件）
    const directReferrals = await prisma.referral.findMany({
      where: {
        ...whereConditions,
        type: 'DIRECT'
      },
      include: {
        referred: {
          select: {
            id: true,
            name: true,
            phone: true,
            currentPhase: true,
            currentTaskIndex: true,
            status: true,
            createdAt: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    })

    // 获取间接邀请列表（应用筛选条件，包含中间人信息）
    const indirectReferrals = await prisma.referral.findMany({
      where: {
        ...whereConditions,
        type: 'INDIRECT'
      },
      include: {
        referred: {
          select: {
            id: true,
            name: true,
            phone: true,
            currentPhase: true,
            currentTaskIndex: true,
            status: true,
            createdAt: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    })

    // 获取间接邀请的中间人信息
    const indirectWithReferrers = await Promise.all(
      indirectReferrals.map(async (ref) => {
        // 通过 indirectReferrerId 获取中间人信息
        const middlePerson = ref.indirectReferrerId
          ? await prisma.teacher.findUnique({
              where: { id: ref.indirectReferrerId },
              select: { name: true }
            })
          : null

        return {
          ...ref,
          referrerName: middlePerson?.name || null
        }
      })
    )

    return {
      success: true,
      data: {
        teacherId: teacher.id,
        referrerName: teacher.name,
        inviteCode: teacher.inviteCode,
        stats,
        directReferrals: directReferrals.map((ref, index) => ({
          id: ref.id,
          index: index + 1,
          referredName: ref.referred.name,
          referredPhone: ref.referred.phone,
          currentPhase: ref.referred.currentPhase,
          currentTaskIndex: ref.referred.currentTaskIndex,
          status: ref.referred.status,
          referralStatus: ref.status,
          rewardSent: ref.rewardSent,
          adminNote: ref.adminNote,
          createdAt: ref.createdAt
        })),
        indirectReferrals: indirectWithReferrers.map((ref, index) => ({
          id: ref.id,
          index: index + 1,
          referredName: ref.referred.name,
          referredPhone: ref.referred.phone,
          referrerName: ref.referrerName, // 中间人名字
          currentPhase: ref.referred.currentPhase,
          currentTaskIndex: ref.referred.currentTaskIndex,
          status: ref.referred.status,
          referralStatus: ref.status,
          adminNote: ref.adminNote,
          createdAt: ref.createdAt
        })),
        pagination: {
          currentPage: 1,
          pageSize: 100,
          totalCount: directReferrals.length + indirectReferrals.length,
          totalPages: 1,
          hasNextPage: false,
          hasPrevPage: false
        }
      }
    }
  } catch (error) {
    console.error('获取邀请数据失败:', error)
    return { success: false, error: '获取数据失败，请重试' }
  }
}

// 获取邀请统计
export async function getReferralStats(teacherId: string) {
  try {
    const referrals = await prisma.referral.findMany({
      where: { referrerId: teacherId }
    })
    
    const stats = {
      total: referrals.length,
      pending: referrals.filter(r => r.status === 'PENDING').length,
      valid: referrals.filter(r => r.status === 'VALID').length,
      invalid: referrals.filter(r => r.status === 'INVALID').length,
      rewardsSent: referrals.filter(r => r.rewardSent).length
    }
    
    return { success: true, stats }
  } catch (error) {
    console.error('获取邀请统计失败:', error)
    return { success: false, error: '获取统计失败' }
  }
}

// 获取我邀请的人列表
export async function getMyReferrals(teacherId: string) {
  try {
    const referrals = await prisma.referral.findMany({
      where: { referrerId: teacherId },
      include: {
        referred: {
          select: {
            id: true,
            name: true,
            currentPhase: true,
            currentTaskIndex: true,
            status: true,
            createdAt: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    })
    
    return { success: true, referrals }
  } catch (error) {
    console.error('获取邀请列表失败:', error)
    return { success: false, error: '获取列表失败' }
  }
}

// ==================== 邀请统计相关功能 ====================

// 更新邀请统计数据
export async function updateReferralStats(teacherId: string) {
  try {
    // 查询该教师的所有邀请记录（包含被邀请人的授课状态）
    const referrals = await prisma.referral.findMany({
      where: { referrerId: teacherId },
      include: {
        referred: {
          select: {
            teachingStatus: true
          }
        }
      }
    })
    
    // 分类统计
    const direct = referrals.filter(r => r.type === 'DIRECT')
    const indirect = referrals.filter(r => r.type === 'INDIRECT')
    
    const stats = {
      directTotal: direct.length,
      directValid: direct.filter(r => r.status === 'VALID').length,
      directPending: direct.filter(r => r.status === 'PENDING').length,
      directInvalid: direct.filter(r => r.status === 'INVALID').length,
      directTaught: direct.filter(r => r.referred.teachingStatus === 'TAUGHT').length,
      
      indirectTotal: indirect.length,
      indirectValid: indirect.filter(r => r.status === 'VALID').length,
      indirectPending: indirect.filter(r => r.status === 'PENDING').length,
      indirectInvalid: indirect.filter(r => r.status === 'INVALID').length,
      indirectTaught: indirect.filter(r => r.referred.teachingStatus === 'TAUGHT').length,
    }
    
    // 计算总收益（包含授课奖励）
    const directReward = await getSystemConfigFromDB('DIRECT_REWARD', 10)
    const indirectReward = await getSystemConfigFromDB('INDIRECT_REWARD', 5)
    const directTeachingReward = await getSystemConfigFromDB('DIRECT_TEACHING_REWARD', 100)
    const indirectTeachingReward = await getSystemConfigFromDB('INDIRECT_TEACHING_REWARD', 20)
    
    const totalEarnings = 
      stats.directValid * directReward + 
      stats.indirectValid * indirectReward +
      stats.directTaught * directTeachingReward +
      stats.indirectTaught * indirectTeachingReward
    
    // 更新或创建统计记录
    await prisma.referralStats.upsert({
      where: { teacherId },
      create: {
        teacherId,
        ...stats,
        totalEarnings
      },
      update: {
        ...stats,
        totalEarnings
      }
    })
    
    return { success: true }
  } catch (error) {
    console.error('更新邀请统计失败:', error)
    return { success: false, error: '更新统计失败' }
  }
}

// 创建邀请记录（支持直接和间接邀请）
export async function createReferralRecord(referrerId: string, referredId: string) {
  try {
    // 1. 创建直接邀请记录
    const directReferral = await prisma.referral.create({
      data: {
        referrerId,
        referredId,
        type: 'DIRECT',
        status: 'PENDING'
      }
    })
    
    // 2. 查找邀请人的上级（间接邀请人）
    // 优先从 Referral 表查询，找不到再查 Teacher.invitedById（兼容历史数据）
    let indirectReferrerId: string | null = null
    
    // 方式1：从 Referral 表查询直接邀请记录
    const referrerReferral = await prisma.referral.findFirst({
      where: {
        referredId: referrerId,
        type: 'DIRECT'
      },
      select: { referrerId: true }
    })
    
    if (referrerReferral) {
      indirectReferrerId = referrerReferral.referrerId
    } else {
      // 方式2：从 Teacher.invitedById 查询（兼容历史数据或未同步的数据）
      const referrerTeacher = await prisma.teacher.findUnique({
        where: { id: referrerId },
        select: { invitedById: true }
      })
      
      if (referrerTeacher?.invitedById) {
        indirectReferrerId = referrerTeacher.invitedById
      }
    }
    
    // 3. 如果邀请人有上级，为上级创建间接邀请记录
    if (indirectReferrerId) {
      await prisma.referral.create({
        data: {
          referrerId: indirectReferrerId,  // 间接邀请人（A）
          referredId,                      // 被邀请人（C）
          type: 'INDIRECT',
          status: 'PENDING',
          indirectReferrerId: referrerId  // 中间人（B）的ID
        }
      })
      
      // 更新间接邀请人的统计
      await updateReferralStats(indirectReferrerId)
    }
    
    // 4. 更新直接邀请人的统计
    await updateReferralStats(referrerId)
    
    return { success: true, directReferral }
  } catch (error) {
    console.error('创建邀请记录失败:', error)
    return { success: false, error: '创建邀请记录失败' }
  }
}

// 更新邀请状态（同步更新间接邀请）
export async function updateReferralStatus(
  referralId: string, 
  newStatus: 'VALID' | 'INVALID',
  adminId: string,
  note?: string
) {
  try {
    // 更新邀请状态
    const referral = await prisma.referral.update({
      where: { id: referralId },
      data: {
        status: newStatus,
        reviewedBy: adminId,
        reviewedAt: new Date(),
        adminNote: note
      }
    })
    
    // 如果是直接邀请，同步更新相关的间接邀请
    if (referral.type === 'DIRECT') {
      await prisma.referral.updateMany({
        where: {
          referredId: referral.referredId,
          type: 'INDIRECT'
        },
        data: {
          status: newStatus,
          reviewedBy: adminId,
          reviewedAt: new Date()
        }
      })
      
      // 获取所有间接邀请人并更新他们的统计
      const indirectReferrals = await prisma.referral.findMany({
        where: {
          referredId: referral.referredId,
          type: 'INDIRECT'
        },
        select: {
          referrerId: true
        }
      })
      
      for (const ir of indirectReferrals) {
        await updateReferralStats(ir.referrerId)
      }
    }
    
    // 更新直接邀请人的统计
    await updateReferralStats(referral.referrerId)
    
    revalidatePath('/admin/referrals')
    
    return { success: true }
  } catch (error) {
    console.error('更新邀请状态失败:', error)
    return { success: false, error: '更新状态失败' }
  }
}

// ==================== 提现相关功能 ====================

// 计算邀请收益（支持直接和间接奖励）
export async function calculateReferralEarnings(teacherId: string) {
  try {
    // 从统计表获取数据（避免实时查询）
    let stats = await prisma.referralStats.findUnique({
      where: { teacherId }
    })
    
    // 如果没有统计数据，先创建
    if (!stats) {
      await updateReferralStats(teacherId)
      stats = await prisma.referralStats.findUnique({
        where: { teacherId }
      })
    }
    
    if (!stats) {
      return {
        success: true,
        earnings: {
          directValid: 0,
          indirectValid: 0,
          directTaught: 0,
          indirectTaught: 0,
          directReward: await getSystemConfigFromDB('DIRECT_REWARD', 10),
          indirectReward: await getSystemConfigFromDB('INDIRECT_REWARD', 5),
          directTeachingReward: await getSystemConfigFromDB('DIRECT_TEACHING_REWARD', 100),
          indirectTeachingReward: await getSystemConfigFromDB('INDIRECT_TEACHING_REWARD', 20),
          totalEarnings: 0,
          totalWithdrawn: 0,
          totalPending: 0,
          availableBalance: 0
        }
      }
    }
    
    // 获取奖励配置
    const directReward = await getSystemConfigFromDB('DIRECT_REWARD', 10)
    const indirectReward = await getSystemConfigFromDB('INDIRECT_REWARD', 5)
    const directTeachingReward = await getSystemConfigFromDB('DIRECT_TEACHING_REWARD', 100)
    const indirectTeachingReward = await getSystemConfigFromDB('INDIRECT_TEACHING_REWARD', 20)
    
    // 计算总收益（包含授课奖励）
    const totalEarnings = 
      stats.directValid * directReward + 
      stats.indirectValid * indirectReward +
      stats.directTaught * directTeachingReward +
      stats.indirectTaught * indirectTeachingReward
    
    // 获取已批准提现总额
    const approvedWithdrawals = await prisma.withdrawal.findMany({
      where: {
        teacherId,
        status: 'APPROVED'
      },
      select: {
        amount: true
      }
    })
    
    const totalWithdrawn = approvedWithdrawals.reduce((sum, w) => sum + w.amount, 0)
    
    // 获取待审核提现总额
    const pendingWithdrawals = await prisma.withdrawal.findMany({
      where: {
        teacherId,
        status: 'PENDING'
      },
      select: {
        amount: true
      }
    })
    
    const totalPending = pendingWithdrawals.reduce((sum, w) => sum + w.amount, 0)
    
    // 计算可提现金额 = 总收益 - 已批准提现 - 待审核提现
    const availableBalance = totalEarnings - totalWithdrawn - totalPending
    
    return {
      success: true,
      earnings: {
        directValid: stats.directValid,
        indirectValid: stats.indirectValid,
        directTaught: stats.directTaught,
        indirectTaught: stats.indirectTaught,
        directReward,
        indirectReward,
        directTeachingReward,
        indirectTeachingReward,
        totalEarnings,
        totalWithdrawn,
        totalPending,
        availableBalance
      }
    }
  } catch (error) {
    console.error('计算邀请收益失败:', error)
    return { success: false, error: '计算收益失败' }
  }
}

// 获取提现信息（包含历史记录和银行信息）
export async function getWithdrawalInfo(teacherId: string) {
  try {
    const teacher = await prisma.teacher.findUnique({
      where: { id: teacherId },
      select: {
        id: true,
        name: true,
        phone: true
      }
    })
    
    if (!teacher) {
      return { success: false, error: '用户不存在' }
    }
    
    // 获取提现历史
    const withdrawals = await prisma.withdrawal.findMany({
      where: { teacherId },
      orderBy: { createdAt: 'desc' }
    })
    
    // 获取最近一次提现的银行信息（用于预填表单）
    const latestWithdrawal = withdrawals[0]
    
    // 计算收益
    const earningsResult = await calculateReferralEarnings(teacherId)
    if (!earningsResult.success || !earningsResult.earnings) {
      return earningsResult
    }
    
    // 检查是否有待处理的提现申请
    const hasPendingWithdrawal = withdrawals.some(w => w.status === 'PENDING')
    
    return {
      success: true,
      data: {
        teacher: {
          name: teacher.name,
          phone: teacher.phone
        },
        earnings: earningsResult.earnings,
        withdrawals: withdrawals.map(w => ({
          id: w.id,
          amount: w.amount,
          accountName: w.accountName,
          bankName: w.bankName,
          cardNumber: w.cardNumber,
          phone: w.phone,
          status: w.status,
          rejectNote: w.rejectNote,
          createdAt: w.createdAt,
          reviewedAt: w.reviewedAt
        })),
        latestBankInfo: latestWithdrawal ? {
          accountName: latestWithdrawal.accountName,
          bankName: latestWithdrawal.bankName,
          cardNumber: latestWithdrawal.cardNumber,
          phone: latestWithdrawal.phone,
          idCard: latestWithdrawal.idCard
        } : null,
        hasPendingWithdrawal
      }
    }
  } catch (error) {
    console.error('获取提现信息失败:', error)
    return { success: false, error: '获取提现信息失败' }
  }
}

// 申请提现
export async function applyForWithdrawal(teacherId: string, data: {
  amount: number
  accountName: string
  bankName: string
  cardNumber: string
  phone: string
  idCard: string
}) {
  try {
    // 验证提现金额
    if (data.amount <= 0) {
      return { success: false, error: '提现金额必须大于0' }
    }
    
    // 计算可提现余额
    const earningsResult = await calculateReferralEarnings(teacherId)
    if (!earningsResult.success) {
      return earningsResult
    }
    
    const { availableBalance } = earningsResult.earnings!
    
    if (data.amount > availableBalance) {
      return { success: false, error: '提现金额超过可用余额' }
    }
    
    // 检查是否已有待处理的提现申请
    const pendingWithdrawal = await prisma.withdrawal.findFirst({
      where: {
        teacherId,
        status: 'PENDING'
      }
    })
    
    if (pendingWithdrawal) {
      return { success: false, error: '您有待处理的提现申请，请等待审核完成后再提交新申请' }
    }
    
    // 创建提现申请
    const withdrawal = await prisma.withdrawal.create({
      data: {
        teacherId,
        amount: data.amount,
        accountName: data.accountName,
        bankName: data.bankName,
        cardNumber: data.cardNumber,
        phone: data.phone,
        idCard: data.idCard,
        status: 'PENDING'
      }
    })
    
    revalidatePath('/referral/withdraw')
    revalidatePath('/referral/dashboard')
    
    return { success: true, withdrawal }
  } catch (error) {
    console.error('申请提现失败:', error)
    return { success: false, error: '申请提现失败，请重试' }
  }
}

// ==================== 管理后台专用 ====================

// 获取老师和邀请的统计数据
export async function getTeacherAndReferralStats() {
  try {
    // 老师统计
    const totalTeachers = await prisma.teacher.count({
      where: { status: { not: 'NOT_STARTED' } }
    })
    
    const inProgressTeachers = await prisma.teacher.count({
      where: {
        OR: [
          { status: 'IN_PROGRESS' },
          { status: 'PENDING_REVIEW' }
        ]
      }
    })
    
    const completedTeachers = await prisma.teacher.count({
      where: { status: 'COMPLETED' }
    })
    
    const unlockedTeachers = await prisma.teacher.count({
      where: { status: 'UNLOCKED' }
    })
    
    // 邀请统计
    const totalReferrals = await prisma.referral.count()
    
    const pendingReferrals = await prisma.referral.count({
      where: { status: 'PENDING' }
    })
    
    const validReferrals = await prisma.referral.count({
      where: { status: 'VALID' }
    })
    
    const invalidReferrals = await prisma.referral.count({
      where: { status: 'INVALID' }
    })
    
    const pendingRewards = await prisma.referral.count({
      where: {
        status: 'VALID',
        rewardSent: false
      }
    })
    
    const rewardsSent = await prisma.referral.count({
      where: { rewardSent: true }
    })
    
    return {
      success: true,
      stats: {
        teachers: {
          total: totalTeachers,
          inProgress: inProgressTeachers,
          completed: completedTeachers,
          unlocked: unlockedTeachers
        },
        referrals: {
          total: totalReferrals,
          pending: pendingReferrals,
          valid: validReferrals,
          invalid: invalidReferrals,
          pendingRewards,
          rewardsSent
        }
      }
    }
  } catch (error) {
    console.error('获取统计数据失败:', error)
    return { success: false, error: '获取统计数据失败' }
  }
}

// 获取老师列表（包含邀请关系）
export async function getTeachersWithReferrals(filters: {
  search?: string
  taskIndex?: string
  startDate?: string
  endDate?: string
  referralStatus?: string  // 'all' | 'hasReferrals' | 'noReferrals' | 'validReferrals'
}) {
  try {
    const { search, taskIndex, startDate, endDate, referralStatus } = filters
    
    // 构建查询条件
    const whereConditions: any[] = []
    
    // 搜索关键词（姓名/ID/邀请码/手机号）
    if (search) {
      whereConditions.push({
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { id: { contains: search } },
          { inviteCode: { contains: search, mode: 'insensitive' } },
          { phone: { contains: search } }
        ]
      })
    }
    
    // 任务进度
    if (taskIndex) {
      whereConditions.push({
        currentTaskIndex: parseInt(taskIndex)
      })
    }
    
    // 注册时间区间
    if (startDate || endDate) {
      const dateFilter: any = {}
      if (startDate) {
        dateFilter.gte = new Date(startDate)
      }
      if (endDate) {
        const endDateTime = new Date(endDate)
        endDateTime.setHours(23, 59, 59, 999)
        dateFilter.lte = endDateTime
      }
      whereConditions.push({
        createdAt: dateFilter
      })
    }
    
    // 查询老师
    const teachers = await prisma.teacher.findMany({
      where: {
        status: { not: 'NOT_STARTED' },
        ...(whereConditions.length > 0 ? { AND: whereConditions } : {})
      },
      include: {
        referrals: {
          include: {
            referred: {
              select: {
                id: true,
                name: true,
                phone: true,
                currentTaskIndex: true,
                currentPhase: true,
                status: true,
                createdAt: true
              }
            }
          },
          orderBy: { createdAt: 'desc' }
        }
      },
      orderBy: { createdAt: 'desc' }
    })
    
    // 根据邀请状态筛选
    let filteredTeachers = teachers
    if (referralStatus === 'hasReferrals') {
      filteredTeachers = teachers.filter(t => t.referrals.length > 0)
    } else if (referralStatus === 'noReferrals') {
      filteredTeachers = teachers.filter(t => t.referrals.length === 0)
    } else if (referralStatus === 'validReferrals') {
      filteredTeachers = teachers.filter(t => 
        t.referrals.some(r => r.status === 'VALID')
      )
    }
    
    // 添加计算字段
    const teachersWithStats = filteredTeachers.map(teacher => ({
      ...teacher,
      totalInvites: teacher.referrals.length,
      validInvites: teacher.referrals.filter(r => r.status === 'VALID').length,
      pendingRewards: teacher.referrals.filter(r => r.status === 'VALID' && !r.rewardSent).length
    }))
    
    return {
      success: true,
      teachers: teachersWithStats
    }
  } catch (error) {
    console.error('获取老师列表失败:', error)
    return { success: false, error: '获取老师列表失败' }
  }
}

// ==================== 提现审核管理 ====================

// 获取所有提现申请列表
export async function getAllWithdrawals(filters?: {
  status?: string
  startDate?: string
  endDate?: string
  search?: string
}) {
  try {
    const where: any = {}
    
    if (filters?.status && filters.status !== 'ALL') {
      where.status = filters.status
    }
    
    if (filters?.startDate || filters?.endDate) {
      where.createdAt = {}
      if (filters.startDate) {
        where.createdAt.gte = new Date(filters.startDate)
      }
      if (filters.endDate) {
        const endDate = new Date(filters.endDate)
        endDate.setHours(23, 59, 59, 999)
        where.createdAt.lte = endDate
      }
    }
    
    if (filters?.search) {
      where.teacher = {
        OR: [
          { name: { contains: filters.search, mode: 'insensitive' } },
          { phone: { contains: filters.search } }
        ]
      }
    }
    
    const withdrawals = await prisma.withdrawal.findMany({
      where,
      include: {
        teacher: {
          select: {
            id: true,
            name: true,
            phone: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    })
    
    return { success: true, withdrawals }
  } catch (error) {
    console.error('获取提现申请列表失败:', error)
    return { success: false, error: '获取提现申请列表失败' }
  }
}

// 获取单个提现申请详情
export async function getWithdrawalDetail(withdrawalId: string) {
  try {
    const withdrawal = await prisma.withdrawal.findUnique({
      where: { id: withdrawalId },
      include: {
        teacher: {
          select: {
            id: true,
            name: true,
            phone: true,
            inviteCode: true,
            createdAt: true
          }
        }
      }
    })
    
    if (!withdrawal) {
      return { success: false, error: '提现申请不存在' }
    }
    
    // 获取推荐人的统计信息
    const stats = await prisma.referralStats.findUnique({
      where: { teacherId: withdrawal.teacherId }
    })
    
    return {
      success: true,
      withdrawal,
      stats
    }
  } catch (error) {
    console.error('获取提现详情失败:', error)
    return { success: false, error: '获取提现详情失败' }
  }
}

// 批准提现申请
export async function approveWithdrawal(withdrawalId: string, adminId: string) {
  try {
    const withdrawal = await prisma.withdrawal.findUnique({
      where: { id: withdrawalId },
      select: { status: true, teacherId: true }
    })
    
    if (!withdrawal) {
      return { success: false, error: '提现申请不存在' }
    }
    
    if (withdrawal.status !== 'PENDING') {
      return { success: false, error: '该申请已处理，无法重复操作' }
    }
    
    // 更新提现申请状态
    await prisma.withdrawal.update({
      where: { id: withdrawalId },
      data: {
        status: 'APPROVED',
        reviewedBy: adminId,
        reviewedAt: new Date()
      }
    })
    
    // 重新计算收益（会更新ReferralStats表）
    await calculateReferralEarnings(withdrawal.teacherId)
    
    revalidatePath('/admin/withdrawals')
    
    return { success: true, message: '已批准提现申请' }
  } catch (error) {
    console.error('批准提现失败:', error)
    return { success: false, error: '批准提现失败，请重试' }
  }
}

// 驳回提现申请
export async function rejectWithdrawal(
  withdrawalId: string,
  adminId: string,
  rejectNote: string
) {
  try {
    const withdrawal = await prisma.withdrawal.findUnique({
      where: { id: withdrawalId },
      select: { status: true, teacherId: true, amount: true }
    })
    
    if (!withdrawal) {
      return { success: false, error: '提现申请不存在' }
    }
    
    if (withdrawal.status !== 'PENDING') {
      return { success: false, error: '该申请已处理，无法重复操作' }
    }
    
    if (!rejectNote?.trim()) {
      return { success: false, error: '请填写驳回原因' }
    }
    
    // 更新提现申请状态
    await prisma.withdrawal.update({
      where: { id: withdrawalId },
      data: {
        status: 'REJECTED',
        reviewedBy: adminId,
        reviewedAt: new Date(),
        rejectNote: rejectNote.trim()
      }
    })
    
    // 重新计算收益（会释放冻结的金额）
    await calculateReferralEarnings(withdrawal.teacherId)
    
    revalidatePath('/admin/withdrawals')
    
    return { success: true, message: '已驳回提现申请' }
  } catch (error) {
    console.error('驳回提现失败:', error)
    return { success: false, error: '驳回提现失败，请重试' }
  }
}

// 重置老师密码（管理员功能）
export async function resetTeacherPassword(teacherId: string, newPassword: string = '123456') {
  try {
    if (!newPassword || newPassword.length < 6) {
      return { success: false, error: '密码至少 6 位' }
    }

    // 验证权限：super_admin 或运营人员均可操作
    const cookieStore = await cookies()
    const adminSession = cookieStore.get('admin_session')
    const operatorSession = cookieStore.get('operator_session')

    let authorized = false
    if (adminSession) {
      const sessionData = JSON.parse(adminSession.value)
      if (sessionData.role === 'super_admin') authorized = true
    }
    if (!authorized && operatorSession) {
      const sessionData = JSON.parse(operatorSession.value)
      if (sessionData.operatorId) authorized = true
    }

    if (!authorized) {
      return { success: false, error: '无权限执行此操作' }
    }

    // 验证老师是否存在
    const teacher = await prisma.teacher.findUnique({
      where: { id: teacherId },
      select: { id: true, name: true, phone: true }
    })

    if (!teacher) {
      return { success: false, error: '老师不存在' }
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10)

    await prisma.teacher.update({
      where: { id: teacherId },
      data: { password: hashedPassword }
    })

    revalidatePath('/admin/teachers')
    
    return { 
      success: true, 
      message: `密码已重置为 ${newPassword}` 
    }
  } catch (error) {
    console.error('重置密码失败:', error)
    return { success: false, error: '重置密码失败，请重试' }
  }
}

// 管理员搜索教师（按名字或 ID，用于设置邀请人弹窗）
export async function searchTeachersForInviter(query: string, excludeId?: string) {
  try {
    const trimmed = query.trim()
    if (!trimmed) {
      return { success: true, teachers: [] }
    }

    const teachers = await prisma.teacher.findMany({
      where: {
        AND: [
          { id: { not: excludeId } },
          {
            OR: [
              { name: { contains: trimmed, mode: 'insensitive' } },
              { id: { contains: trimmed } },
            ]
          }
        ]
      },
      select: { id: true, name: true, phone: true },
      take: 10,
      orderBy: { createdAt: 'desc' }
    })

    return { success: true, teachers }
  } catch (error) {
    console.error('搜索教师失败:', error)
    return { success: false, teachers: [], error: '搜索失败，请重试' }
  }
}

// 管理员设置教师的邀请人
export async function setTeacherInviter(teacherId: string, inviterId: string) {
  try {
    if (!teacherId || !inviterId) {
      return { success: false, error: '参数不完整' }
    }

    if (teacherId === inviterId) {
      return { success: false, error: '不能将自己设为邀请人' }
    }

    // 验证被操作的教师存在
    const teacher = await prisma.teacher.findUnique({
      where: { id: teacherId },
      select: { id: true, name: true, invitedById: true }
    })
    if (!teacher) {
      return { success: false, error: '教师不存在' }
    }

    // 验证邀请人存在
    const inviter = await prisma.teacher.findUnique({
      where: { id: inviterId },
      select: { id: true, name: true }
    })
    if (!inviter) {
      return { success: false, error: '邀请人不存在，请确认 ID 是否正确' }
    }

    // 如果已有旧邀请人，清除旧的邀请关系记录
    // 找出所有关于该教师的邀请记录（直接 + 间接），这些记录来自旧邀请链
    const oldReferrals = await prisma.referral.findMany({
      where: { referredId: teacherId },
      select: { id: true, referrerId: true }
    })

    if (oldReferrals.length > 0) {
      // 删除所有旧记录
      await prisma.referral.deleteMany({
        where: { referredId: teacherId }
      })

      // 收集受影响的旧邀请人 ID（去重），重算其统计
      const affectedReferrerIds = [...new Set(oldReferrals.map(r => r.referrerId))]
      await Promise.all(affectedReferrerIds.map(id => updateReferralStats(id)))
    }

    // 更新 invitedById 字段
    await prisma.teacher.update({
      where: { id: teacherId },
      data: { invitedById: inviterId }
    })

    // 为新邀请人创建邀请记录（含间接邀请逻辑）
    await createReferralRecord(inviterId, teacherId)

    revalidatePath(`/admin/teachers/${teacherId}`)
    revalidatePath('/admin/referrals')

    return { success: true, inviterName: inviter.name || inviterId }
  } catch (error) {
    console.error('设置邀请人失败:', error)
    return { success: false, error: '设置邀请人失败，请重试' }
  }
}

