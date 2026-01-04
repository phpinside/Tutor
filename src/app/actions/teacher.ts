'use server'

import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import { REFERRAL_CONFIG } from '@/lib/config'

// 获取或创建老师
export async function getOrCreateTeacher(teacherId?: string) {
  try {
    if (teacherId) {
      const teacher = await prisma.teacher.findUnique({
        where: { id: teacherId },
        include: {
          taskSubmissions: {
            orderBy: { taskIndex: 'asc' }
          }
        }
      })
      
      if (teacher) return teacher
    }
    
    // 创建新老师
    const newTeacher = await prisma.teacher.create({
      data: {
        status: 'NOT_STARTED'
      },
      include: {
        taskSubmissions: true
      }
    })
    
    return newTeacher
  } catch (error) {
    console.error('获取或创建老师失败:', error)
    throw new Error('操作失败,请重试')
  }
}

// 更新老师基本信息
export async function updateTeacherInfo(teacherId: string, data: {
  // 基础信息
  name?: string
  phone?: string
  gender?: string
  age?: string
  school?: string
  graduationYear?: string
  identity?: string
  
  // 教学能力 & 资质
  mathScore?: string
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
      totalEarnings: 0,
      totalWithdrawn: 0,
      totalPending: 0,
      availableBalance: 0,
      validReferralsCount: 0
    }

    // 计算统计数据
    const stats = {
      total: allReferrals.length,
      validReferrals: earnings!.validReferralsCount,
      totalWithdrawn: earnings!.totalWithdrawn,
      totalPending: earnings!.totalPending,
      availableBalance: earnings!.availableBalance,
      // 保留旧的统计字段以兼容
      pending: allReferrals.filter(r => r.status === 'PENDING').length,
      valid: allReferrals.filter(r => r.status === 'VALID').length,
      completed: allReferrals.filter(r => 
        r.referred.status === 'COMPLETED' || r.referred.status === 'UNLOCKED'
      ).length,
      invalid: allReferrals.filter(r => r.status === 'INVALID').length,
      rewardsSent: allReferrals.filter(r => r.rewardSent).length
    }

    // 分页参数
    const page = filters?.page || 1
    const pageSize = filters?.pageSize || 100
    const skip = (page - 1) * pageSize

    // 获取分页数据
    const referrals = await prisma.referral.findMany({
      where: whereConditions,
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
      orderBy: { createdAt: 'desc' },
      skip,
      take: pageSize
    })

    // 计算分页信息
    const totalPages = Math.ceil(totalCount / pageSize)

    return {
      success: true,
      data: {
        teacherId: teacher.id,
        referrerName: teacher.name,
        inviteCode: teacher.inviteCode,
        stats,
        referrals: referrals.map((ref, index) => ({
          id: ref.id,
          index: skip + index + 1,
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
        pagination: {
          currentPage: page,
          pageSize,
          totalCount,
          totalPages,
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1
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

// ==================== 提现相关功能 ====================

// 计算邀请收益
export async function calculateReferralEarnings(teacherId: string) {
  try {
    // 获取所有有效邀请
    const validReferrals = await prisma.referral.count({
      where: {
        referrerId: teacherId,
        status: 'VALID'
      }
    })
    
    // 计算总收益
    const totalEarnings = validReferrals * REFERRAL_CONFIG.rewardPerValidReferral
    
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
    
    // 获取待审核提现总额（申请后立即冻结，驳回后自动释放）
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
        totalEarnings,
        totalWithdrawn,
        totalPending,
        availableBalance,
        validReferralsCount: validReferrals
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


