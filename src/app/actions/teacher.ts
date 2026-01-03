'use server'

import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'

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

// 为老师生成邀请码和查看码（如果还没有）
export async function ensureInviteCodes(teacherId: string) {
  try {
    const teacher = await prisma.teacher.findUnique({
      where: { id: teacherId },
      select: { inviteCode: true, referralViewCode: true }
    })
    
    if (!teacher) {
      throw new Error('老师不存在')
    }
    
    // 如果已有邀请码，直接返回
    if (teacher.inviteCode && teacher.referralViewCode) {
      return {
        success: true,
        inviteCode: teacher.inviteCode,
        viewCode: teacher.referralViewCode
      }
    }
    
    // 生成唯一的邀请码和查看码
    let inviteCode = teacher.inviteCode
    let viewCode = teacher.referralViewCode
    
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
    
    // 生成查看码
    if (!viewCode) {
      let attempts = 0
      while (!viewCode && attempts < 10) {
        const candidate = generateRandomCode('VIEW-', 8)
        const existing = await prisma.teacher.findUnique({
          where: { referralViewCode: candidate }
        })
        if (!existing) {
          viewCode = candidate
        }
        attempts++
      }
      if (!viewCode) {
        throw new Error('生成查看码失败，请重试')
      }
    }
    
    // 更新数据库
    await prisma.teacher.update({
      where: { id: teacherId },
      data: {
        inviteCode,
        referralViewCode: viewCode
      }
    })
    
    return {
      success: true,
      inviteCode,
      viewCode
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

// 通过查看码获取邀请统计和列表（用于邀请看板）
export async function getReferralDataByViewCode(viewCode: string) {
  try {
    const teacher = await prisma.teacher.findUnique({
      where: { referralViewCode: viewCode },
      include: {
        referrals: {
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
        }
      }
    })
    
    if (!teacher) {
      return { success: false, error: '查看码无效' }
    }
    
    // 计算统计数据
    const totalReferrals = teacher.referrals.length
    const completedReferrals = teacher.referrals.filter(r => 
      r.referred.status === 'COMPLETED' || r.referred.status === 'UNLOCKED'
    ).length
    const invalidReferrals = teacher.referrals.filter(r => r.status === 'INVALID').length
    const rewardsSent = teacher.referrals.filter(r => r.rewardSent).length
    
    return {
      success: true,
      data: {
        teacherId: teacher.id,
        referrerName: teacher.name,
        inviteCode: teacher.inviteCode,
        stats: {
          total: totalReferrals,
          completed: completedReferrals,
          invalid: invalidReferrals,
          rewardsSent
        },
        referrals: teacher.referrals.map((ref, index) => ({
          id: ref.id,
          index: index + 1,
          referredName: ref.referred.name || `用户 #${index + 1}`,
          referredPhone: ref.referred.phone,
          currentPhase: ref.referred.currentPhase,
          currentTaskIndex: ref.referred.currentTaskIndex,
          status: ref.referred.status,
          referralStatus: ref.status,
          rewardSent: ref.rewardSent,
          adminNote: ref.adminNote,
          createdAt: ref.createdAt
        }))
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


