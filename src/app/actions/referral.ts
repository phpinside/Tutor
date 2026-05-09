'use server'

import { cookies } from 'next/headers'
import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import { updateReferralStats } from './teacher'

// 类型定义
export type ReferralFilters = {
  status?: 'PENDING' | 'VALID' | 'INVALID'
  rewardSent?: boolean
  type?: 'DIRECT' | 'INDIRECT' // 邀请类型
  search?: string // 搜索邀请人或被邀请人姓名/手机号
  inviteCode?: string // 邀请码
  startDate?: string // 邀请开始日期
  endDate?: string // 邀请结束日期
  taskProgress?: string // 任务进度 '0'-'6'
  completionStatus?: string // 完成状态: 'in_progress' | 'completed'
  rewardStatus?: string // 奖励状态: 'sent' | 'pending' | 'all'
  teachingStatus?: string // 授课状态: 'taught' | 'not_taught'
}

export type BatchAction = 
  | { type: 'mark_valid' }
  | { type: 'mark_invalid'; note: string }
  | { type: 'mark_reward_sent' }

export type RejectedDirectReferralInfo = {
  id: string
  adminNote: string | null
  reviewedAt: Date | null
}

/** 被邀请人：是否存在「直接邀请已被驳回」记录（用于引导返工流程） */
export async function getRejectedDirectReferralForReferred(
  teacherId: string
): Promise<RejectedDirectReferralInfo | null> {
  try {
    return await prisma.referral.findFirst({
      where: {
        referredId: teacherId,
        type: 'DIRECT',
        status: 'INVALID'
      },
      orderBy: { reviewedAt: 'desc' },
      select: {
        id: true,
        adminNote: true,
        reviewedAt: true
      }
    })
  } catch (error) {
    console.error('查询驳回邀请失败:', error)
    return null
  }
}

/** 被邀请人：直接邀请记录的审核状态（无记录返回 null） */
export async function getDirectReferralStatusForReferred(
  teacherId: string
): Promise<{ status: 'PENDING' | 'VALID' | 'INVALID' } | null> {
  try {
    return await prisma.referral.findFirst({
      where: {
        referredId: teacherId,
        type: 'DIRECT',
      },
      select: { status: true },
    })
  } catch (error) {
    console.error('查询直接邀请状态失败:', error)
    return null
  }
}

/** 被邀请人：修改任务后重新将直接邀请置为待审核（并同步间接邀请） */
export async function resubmitDirectReferralAfterRejection(): Promise<
  { success: true } | { success: false; error: string }
> {
  try {
    const cookieStore = await cookies()
    const teacherId = cookieStore.get('teacherId')?.value
    if (!teacherId) {
      return { success: false, error: '未登录' }
    }

    const referral = await prisma.referral.findFirst({
      where: {
        referredId: teacherId,
        type: 'DIRECT',
        status: 'INVALID'
      },
      orderBy: { reviewedAt: 'desc' },
      select: {
        id: true,
        type: true,
        referrerId: true,
        referredId: true
      }
    })

    if (!referral) {
      return { success: false, error: '没有需要重新提交的审核记录' }
    }

    await prisma.referral.update({
      where: { id: referral.id },
      data: {
        status: 'PENDING',
        adminNote: null,
        reviewedBy: null,
        reviewedAt: null
      }
    })

    await updateReferralStats(referral.referrerId)

    if (referral.type === 'DIRECT') {
      await prisma.referral.updateMany({
        where: {
          referredId: referral.referredId,
          type: 'INDIRECT'
        },
        data: {
          status: 'PENDING',
          reviewedBy: null,
          reviewedAt: null
        }
      })

      const indirectReferrals = await prisma.referral.findMany({
        where: {
          referredId: referral.referredId,
          type: 'INDIRECT'
        },
        select: { referrerId: true }
      })

      for (const ir of indirectReferrals) {
        await updateReferralStats(ir.referrerId)
      }
    }

    revalidatePath('/onboarding')
    revalidatePath('/onboarding/complete')
    revalidatePath('/admin/referrals')
    revalidatePath('/referral/dashboard')

    return { success: true }
  } catch (error) {
    console.error('重新提交邀请审核失败:', error)
    return { success: false, error: '提交失败，请重试' }
  }
}

// 管理员：获取所有邀请记录
export async function getAllReferrals(filters?: ReferralFilters, page: number = 1, pageSize: number = 50) {
  try {
    const whereConditions: any[] = []
    
    // 邀请状态
    if (filters?.status) {
      whereConditions.push({ status: filters.status })
    }
    
    // 邀请类型
    if (filters?.type) {
      whereConditions.push({ type: filters.type })
    }
    
    // 奖励发放状态（优先使用 rewardStatus）
    if (filters?.rewardStatus === 'sent') {
      whereConditions.push({ rewardSent: true })
    } else if (filters?.rewardStatus === 'pending') {
      whereConditions.push({ rewardSent: false })
    } else if (filters?.rewardSent !== undefined) {
      whereConditions.push({ rewardSent: filters.rewardSent })
    }
    
    // 搜索条件（姓名/手机号）
    if (filters?.search) {
      whereConditions.push({
        OR: [
          { referrer: { name: { contains: filters.search, mode: 'insensitive' } } },
          { referrer: { phone: { contains: filters.search } } },
          { referred: { name: { contains: filters.search, mode: 'insensitive' } } },
          { referred: { phone: { contains: filters.search } } }
        ]
      })
    }
    
    // 邀请码筛选
    if (filters?.inviteCode) {
      whereConditions.push({
        referrer: { inviteCode: { contains: filters.inviteCode, mode: 'insensitive' } }
      })
    }
    
    // 邀请时间区间
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
      whereConditions.push({ createdAt: dateFilter })
    }
    
    // 任务进度筛选
    if (filters?.taskProgress) {
      whereConditions.push({
        referred: { currentTaskIndex: parseInt(filters.taskProgress) }
      })
    }
    
    // 完成状态筛选
    if (filters?.completionStatus === 'completed') {
      whereConditions.push({
        referred: { status: { in: ['COMPLETED', 'UNLOCKED'] } }
      })
    } else if (filters?.completionStatus === 'in_progress') {
      whereConditions.push({
        referred: { status: { notIn: ['COMPLETED', 'UNLOCKED', 'NOT_STARTED'] } }
      })
    }
    
    // 授课状态筛选
    if (filters?.teachingStatus) {
      whereConditions.push({
        referred: { 
          teachingStatus: filters.teachingStatus === 'taught' ? 'TAUGHT' : 'NOT_TAUGHT'
        }
      })
    }
    
    const where = whereConditions.length > 0 ? { AND: whereConditions } : {}
    
    // 计算总数（用于分页）
    const totalCount = await prisma.referral.count({ where })
    
    // 分页查询
    const referrals = await prisma.referral.findMany({
      where,
      include: {
        referrer: {
          select: {
            id: true,
            name: true,
            phone: true,
            inviteCode: true
          }
        },
        referred: {
          select: {
            id: true,
            name: true,
            phone: true,
            currentPhase: true,
            currentTaskIndex: true,
            status: true,
            teachingStatus: true,
            createdAt: true
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize
    })
    
    // 计算统计数据（全部数据，不分页）
    const allReferrals = await prisma.referral.findMany()
    const stats = {
      total: allReferrals.length,
      directTotal: allReferrals.filter(r => r.type === 'DIRECT').length,
      indirectTotal: allReferrals.filter(r => r.type === 'INDIRECT').length,
      pending: allReferrals.filter(r => r.status === 'PENDING').length,
      valid: allReferrals.filter(r => r.status === 'VALID').length,
      invalid: allReferrals.filter(r => r.status === 'INVALID').length,
      pendingReward: allReferrals.filter(r => r.status === 'VALID' && !r.rewardSent).length,
      rewardsSent: allReferrals.filter(r => r.rewardSent).length
    }
    
    return { success: true, referrals, stats, totalCount }
  } catch (error) {
    console.error('获取邀请记录失败:', error)
    return { success: false, error: '获取记录失败，请重试' }
  }
}

// 管理员：获取单个邀请记录详情
export async function getReferralById(referralId: string) {
  try {
    const referral = await prisma.referral.findUnique({
      where: { id: referralId },
      include: {
        referrer: {
          select: {
            id: true,
            name: true,
            phone: true,
            inviteCode: true,
            invitedById: true
          }
        },
        referred: {
          select: {
            id: true,
            name: true,
            phone: true,
            currentPhase: true,
            currentTaskIndex: true,
            status: true,
            createdAt: true,
            updatedAt: true
          }
        }
      }
    })
    
    if (!referral) {
      return { success: false, error: '记录不存在' }
    }
    
    // 如果是直接邀请，查询是否有间接邀请关系（A -> B -> C）
    let indirectReferrer = null
    let indirectReferral = null
    
    if (referral.type === 'DIRECT' && referral.referrer.invitedById) {
      // B 有邀请人 A，查询 A 的信息
      indirectReferrer = await prisma.teacher.findUnique({
        where: { id: referral.referrer.invitedById },
        select: {
          id: true,
          name: true,
          phone: true,
          inviteCode: true
        }
      })
      
      // 查询 A -> C 的间接邀请记录
      if (indirectReferrer) {
        indirectReferral = await prisma.referral.findFirst({
          where: {
            referrerId: indirectReferrer.id,
            referredId: referral.referredId,
            type: 'INDIRECT',
            indirectReferrerId: referral.referrerId
          }
        })
      }
    }
    
    return { 
      success: true, 
      referral,
      indirectReferrer,
      indirectReferral
    }
  } catch (error) {
    console.error('获取邀请记录详情失败:', error)
    return { success: false, error: '获取详情失败' }
  }
}

// 管理员：更新邀请状态
export async function updateReferralStatus(
  referralId: string, 
  status: 'PENDING' | 'VALID' | 'INVALID', 
  note?: string,
  reviewedBy?: string
) {
  try {
    // 更新主邀请记录
    const referral = await prisma.referral.update({
      where: { id: referralId },
      data: {
        status,
        adminNote: note,
        reviewedBy,
        reviewedAt: new Date()
      },
      select: {
        id: true,
        type: true,
        referrerId: true,
        referredId: true,
        status: true
      }
    })
    
    // 更新直接邀请人的统计
    await updateReferralStats(referral.referrerId)
    
    // 如果是直接邀请，同步更新所有相关的间接邀请
    if (referral.type === 'DIRECT') {
      await prisma.referral.updateMany({
        where: {
          referredId: referral.referredId,
          type: 'INDIRECT'
        },
        data: {
          status,
          reviewedBy,
          reviewedAt: new Date()
          // 注意：不更新 adminNote，因为间接邀请的备注可能不同
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
    
    // 刷新相关页面
    revalidatePath('/admin/referrals')
    revalidatePath('/referral/dashboard')
    revalidatePath(`/admin/teachers/${referral.referredId}`)
    
    return { success: true, referral }
  } catch (error) {
    console.error('更新邀请状态失败:', error)
    return { success: false, error: '更新失败，请重试' }
  }
}

// 管理员：标记奖励已发放
export async function markRewardSent(referralId: string, reviewedBy?: string) {
  try {
    const referral = await prisma.referral.update({
      where: { id: referralId },
      data: {
        rewardSent: true,
        reviewedBy,
        reviewedAt: new Date()
      }
    })
    
    // 刷新相关页面
    revalidatePath('/admin/referrals')
    revalidatePath('/referral/dashboard')
    
    return { success: true, referral }
  } catch (error) {
    console.error('标记奖励已发放失败:', error)
    return { success: false, error: '操作失败，请重试' }
  }
}

// 管理员：批量操作
export async function batchUpdateReferrals(
  referralIds: string[], 
  action: BatchAction,
  reviewedBy?: string
) {
  try {
    let updateData: any = {
      reviewedBy,
      reviewedAt: new Date()
    }
    
    if (action.type === 'mark_valid') {
      updateData.status = 'VALID'
      updateData.adminNote = null
    } else if (action.type === 'mark_invalid') {
      updateData.status = 'INVALID'
      updateData.adminNote = action.note
    } else if (action.type === 'mark_reward_sent') {
      updateData.rewardSent = true
    }
    
    // 获取被更新的邀请记录（用于后续统计更新）
    const updatedReferrals = await prisma.referral.findMany({
      where: {
        id: { in: referralIds }
      },
      select: {
        id: true,
        type: true,
        referrerId: true,
        referredId: true
      }
    })
    
    // 批量更新主邀请记录
    const result = await prisma.referral.updateMany({
      where: {
        id: { in: referralIds }
      },
      data: updateData
    })
    
    // 更新所有涉及的邀请人的统计
    const referrerIds = new Set(updatedReferrals.map(r => r.referrerId))
    
    // 如果更新的是邀请状态，需要同步间接邀请
    if (action.type === 'mark_valid' || action.type === 'mark_invalid') {
      // 查找所有被更新的直接邀请记录
      const directReferrals = updatedReferrals.filter(r => r.type === 'DIRECT')
      
      // 如果有直接邀请，同步更新对应的间接邀请
      if (directReferrals.length > 0) {
        const referredIds = directReferrals.map(r => r.referredId)
        await prisma.referral.updateMany({
          where: {
            referredId: { in: referredIds },
            type: 'INDIRECT'
          },
          data: {
            status: updateData.status,
            reviewedBy: updateData.reviewedBy,
            reviewedAt: updateData.reviewedAt
          }
        })
        
        // 获取所有间接邀请人的ID
        const indirectReferrals = await prisma.referral.findMany({
          where: {
            referredId: { in: referredIds },
            type: 'INDIRECT'
          },
          select: {
            referrerId: true
          }
        })
        
        // 添加到需要更新统计的列表
        indirectReferrals.forEach(ir => referrerIds.add(ir.referrerId))
      }
    }
    
    // 批量更新所有相关邀请人的统计
    for (const referrerId of referrerIds) {
      await updateReferralStats(referrerId)
    }
    
    // 刷新相关页面
    revalidatePath('/admin/referrals')
    revalidatePath('/referral/dashboard')
    
    return { success: true, count: result.count }
  } catch (error) {
    console.error('批量操作失败:', error)
    return { success: false, error: '批量操作失败，请重试' }
  }
}

// 管理员：获取邀请统计概览
export async function getReferralOverview() {
  try {
    const allReferrals = await prisma.referral.findMany({
      include: {
        referred: {
          select: {
            status: true
          }
        }
      }
    })
    
    const stats = {
      total: allReferrals.length,
      pending: allReferrals.filter(r => r.status === 'PENDING').length,
      valid: allReferrals.filter(r => r.status === 'VALID').length,
      invalid: allReferrals.filter(r => r.status === 'INVALID').length,
      pendingReward: allReferrals.filter(r => r.status === 'VALID' && !r.rewardSent).length,
      rewardsSent: allReferrals.filter(r => r.rewardSent).length,
      completedReferrals: allReferrals.filter(r => 
        r.referred.status === 'COMPLETED' || r.referred.status === 'UNLOCKED'
      ).length
    }
    
    return { success: true, stats }
  } catch (error) {
    console.error('获取统计概览失败:', error)
    return { success: false, error: '获取统计失败' }
  }
}

// 管理员：标记授课完成
export async function markTeachingCompleted(
  referralId: string,
  lessonNote: string,
  reviewedBy?: string
) {
  try {
    // 验证必填字段
    if (!lessonNote?.trim()) {
      return { success: false, error: '请填写授课备注' }
    }

    // 获取邀请记录
    const referral = await prisma.referral.findUnique({
      where: { id: referralId },
      include: {
        referred: {
          select: {
            id: true,
            teachingStatus: true
          }
        }
      }
    })

    if (!referral) {
      return { success: false, error: '邀请记录不存在' }
    }

    // 检查是否已经标记为授课完成
    if (referral.referred.teachingStatus === 'TAUGHT') {
      return { success: false, error: '该老师已标记为授课完成' }
    }

    // 更新被邀请人的授课状态
    await prisma.teacher.update({
      where: { id: referral.referredId },
      data: {
        teachingStatus: 'TAUGHT'
      }
    })

    // 更新邀请记录的授课备注
    await prisma.referral.update({
      where: { id: referralId },
      data: {
        lessonNote,
        verifiedBy: reviewedBy,
        verifiedAt: new Date()
      }
    })

    // 更新直接邀请人的统计
    await updateReferralStats(referral.referrerId)

    // 如果是直接邀请，也需要更新间接邀请人的统计
    if (referral.type === 'DIRECT') {
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

    // 刷新相关页面
    revalidatePath('/admin/referrals')
    revalidatePath('/referral/dashboard')

    return { success: true }
  } catch (error) {
    console.error('标记授课完成失败:', error)
    return { success: false, error: '操作失败，请重试' }
  }
}
