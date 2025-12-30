'use server'

import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'

// 类型定义
export type ReferralFilters = {
  status?: 'VALID' | 'INVALID'
  rewardSent?: boolean
  search?: string // 搜索邀请人或被邀请人姓名/手机号
}

export type BatchAction = 
  | { type: 'mark_valid' }
  | { type: 'mark_invalid'; note: string }
  | { type: 'mark_reward_sent' }

// 管理员：获取所有邀请记录
export async function getAllReferrals(filters?: ReferralFilters) {
  try {
    const where: any = {}
    
    if (filters?.status) {
      where.status = filters.status
    }
    
    if (filters?.rewardSent !== undefined) {
      where.rewardSent = filters.rewardSent
    }
    
    // 如果有搜索条件，需要关联查询
    if (filters?.search) {
      where.OR = [
        { referrer: { name: { contains: filters.search, mode: 'insensitive' } } },
        { referrer: { phone: { contains: filters.search } } },
        { referred: { name: { contains: filters.search, mode: 'insensitive' } } },
        { referred: { phone: { contains: filters.search } } }
      ]
    }
    
    const referrals = await prisma.referral.findMany({
      where,
      include: {
        referrer: {
          select: {
            id: true,
            name: true,
            phone: true
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
            createdAt: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    })
    
    // 计算统计数据
    const allReferrals = await prisma.referral.findMany()
    const stats = {
      total: allReferrals.length,
      valid: allReferrals.filter(r => r.status === 'VALID').length,
      invalid: allReferrals.filter(r => r.status === 'INVALID').length,
      pendingReward: allReferrals.filter(r => r.status === 'VALID' && !r.rewardSent).length,
      rewardsSent: allReferrals.filter(r => r.rewardSent).length
    }
    
    return { success: true, referrals, stats }
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
            referralViewCode: true
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
    
    return { success: true, referral }
  } catch (error) {
    console.error('获取邀请记录详情失败:', error)
    return { success: false, error: '获取详情失败' }
  }
}

// 管理员：更新邀请状态
export async function updateReferralStatus(
  referralId: string, 
  status: 'VALID' | 'INVALID', 
  note?: string,
  reviewedBy?: string
) {
  try {
    const referral = await prisma.referral.update({
      where: { id: referralId },
      data: {
        status,
        adminNote: note,
        reviewedBy,
        reviewedAt: new Date()
      }
    })
    
    // 刷新相关页面
    revalidatePath('/admin/referrals')
    if (referral.referrerId) {
      const referrer = await prisma.teacher.findUnique({
        where: { id: referral.referrerId },
        select: { referralViewCode: true }
      })
      if (referrer?.referralViewCode) {
        revalidatePath(`/referral/${referrer.referralViewCode}`)
      }
    }
    
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
    if (referral.referrerId) {
      const referrer = await prisma.teacher.findUnique({
        where: { id: referral.referrerId },
        select: { referralViewCode: true }
      })
      if (referrer?.referralViewCode) {
        revalidatePath(`/referral/${referrer.referralViewCode}`)
      }
    }
    
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
    
    const result = await prisma.referral.updateMany({
      where: {
        id: { in: referralIds }
      },
      data: updateData
    })
    
    // 刷新相关页面
    revalidatePath('/admin/referrals')
    
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
