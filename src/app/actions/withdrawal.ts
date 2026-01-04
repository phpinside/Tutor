'use server'

import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'

// 获取所有提现申请（管理员）
export async function getAllWithdrawals(filters?: {
  status?: string // 'all' | 'PENDING' | 'APPROVED' | 'REJECTED'
  startDate?: string
  endDate?: string
  search?: string // 搜索姓名、手机号、卡号
}) {
  try {
    // 构建查询条件
    const whereConditions: any = {}
    
    // 状态筛选
    if (filters?.status && filters.status !== 'all') {
      whereConditions.status = filters.status
    }
    
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
    
    // 搜索条件（姓名、手机号、卡号）
    if (filters?.search) {
      whereConditions.OR = [
        { accountName: { contains: filters.search, mode: 'insensitive' } },
        { phone: { contains: filters.search } },
        { cardNumber: { contains: filters.search } }
      ]
    }
    
    // 获取提现申请列表
    const withdrawals = await prisma.withdrawal.findMany({
      where: whereConditions,
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
    
    // 统计数据
    const stats = {
      total: await prisma.withdrawal.count(),
      pending: await prisma.withdrawal.count({ where: { status: 'PENDING' } }),
      approved: await prisma.withdrawal.count({ where: { status: 'APPROVED' } }),
      rejected: await prisma.withdrawal.count({ where: { status: 'REJECTED' } }),
      totalAmount: withdrawals
        .filter(w => w.status === 'APPROVED')
        .reduce((sum, w) => sum + w.amount, 0)
    }
    
    return {
      success: true,
      withdrawals: withdrawals.map(w => ({
        id: w.id,
        teacherId: w.teacherId,
        teacherName: w.teacher.name,
        teacherPhone: w.teacher.phone,
        amount: w.amount,
        accountName: w.accountName,
        bankName: w.bankName,
        cardNumber: w.cardNumber,
        phone: w.phone,
        idCard: w.idCard,
        status: w.status,
        rejectNote: w.rejectNote,
        reviewedBy: w.reviewedBy,
        reviewedAt: w.reviewedAt,
        createdAt: w.createdAt
      })),
      stats
    }
  } catch (error) {
    console.error('获取提现申请列表失败:', error)
    return { success: false, error: '获取提现申请列表失败' }
  }
}

// 获取提现详情（管理员）
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
            createdAt: true
          }
        }
      }
    })
    
    if (!withdrawal) {
      return { success: false, error: '提现申请不存在' }
    }
    
    // 获取该老师的邀请统计
    const referrals = await prisma.referral.findMany({
      where: { referrerId: withdrawal.teacherId }
    })
    
    const referralStats = {
      total: referrals.length,
      valid: referrals.filter(r => r.status === 'VALID').length,
      invalid: referrals.filter(r => r.status === 'INVALID').length,
      pending: referrals.filter(r => r.status === 'PENDING').length
    }
    
    // 获取该老师的提现历史
    const withdrawalHistory = await prisma.withdrawal.findMany({
      where: { teacherId: withdrawal.teacherId },
      orderBy: { createdAt: 'desc' }
    })
    
    const withdrawalStats = {
      totalApplied: withdrawalHistory.length,
      totalApproved: withdrawalHistory.filter(w => w.status === 'APPROVED').length,
      totalRejected: withdrawalHistory.filter(w => w.status === 'REJECTED').length,
      totalAmount: withdrawalHistory
        .filter(w => w.status === 'APPROVED')
        .reduce((sum, w) => sum + w.amount, 0)
    }
    
    return {
      success: true,
      withdrawal: {
        id: withdrawal.id,
        amount: withdrawal.amount,
        accountName: withdrawal.accountName,
        bankName: withdrawal.bankName,
        cardNumber: withdrawal.cardNumber,
        phone: withdrawal.phone,
        idCard: withdrawal.idCard,
        status: withdrawal.status,
        rejectNote: withdrawal.rejectNote,
        reviewedBy: withdrawal.reviewedBy,
        reviewedAt: withdrawal.reviewedAt,
        createdAt: withdrawal.createdAt
      },
      teacher: {
        id: withdrawal.teacher.id,
        name: withdrawal.teacher.name,
        phone: withdrawal.teacher.phone,
        createdAt: withdrawal.teacher.createdAt
      },
      referralStats,
      withdrawalStats,
      withdrawalHistory: withdrawalHistory.map(w => ({
        id: w.id,
        amount: w.amount,
        status: w.status,
        createdAt: w.createdAt,
        reviewedAt: w.reviewedAt
      }))
    }
  } catch (error) {
    console.error('获取提现详情失败:', error)
    return { success: false, error: '获取提现详情失败' }
  }
}

// 批准提现（管理员）
export async function approveWithdrawal(withdrawalId: string, adminId: string) {
  try {
    const withdrawal = await prisma.withdrawal.update({
      where: { id: withdrawalId },
      data: {
        status: 'APPROVED',
        reviewedBy: adminId,
        reviewedAt: new Date()
      }
    })
    
    revalidatePath('/admin/withdrawals')
    revalidatePath(`/admin/withdrawals/${withdrawalId}`)
    
    return { success: true, withdrawal }
  } catch (error) {
    console.error('批准提现失败:', error)
    return { success: false, error: '批准提现失败' }
  }
}

// 驳回提现（管理员）
export async function rejectWithdrawal(
  withdrawalId: string,
  adminId: string,
  rejectNote: string
) {
  try {
    if (!rejectNote.trim()) {
      return { success: false, error: '请填写驳回原因' }
    }
    
    const withdrawal = await prisma.withdrawal.update({
      where: { id: withdrawalId },
      data: {
        status: 'REJECTED',
        rejectNote,
        reviewedBy: adminId,
        reviewedAt: new Date()
      }
    })
    
    revalidatePath('/admin/withdrawals')
    revalidatePath(`/admin/withdrawals/${withdrawalId}`)
    
    return { success: true, withdrawal }
  } catch (error) {
    console.error('驳回提现失败:', error)
    return { success: false, error: '驳回提现失败' }
  }
}

// 获取提现统计（管理员仪表盘）
export async function getWithdrawalStats() {
  try {
    const total = await prisma.withdrawal.count()
    const pending = await prisma.withdrawal.count({ where: { status: 'PENDING' } })
    const approved = await prisma.withdrawal.count({ where: { status: 'APPROVED' } })
    const rejected = await prisma.withdrawal.count({ where: { status: 'REJECTED' } })
    
    const approvedWithdrawals = await prisma.withdrawal.findMany({
      where: { status: 'APPROVED' },
      select: { amount: true }
    })
    
    const totalAmount = approvedWithdrawals.reduce((sum, w) => sum + w.amount, 0)
    
    return {
      success: true,
      stats: {
        total,
        pending,
        approved,
        rejected,
        totalAmount
      }
    }
  } catch (error) {
    console.error('获取提现统计失败:', error)
    return { success: false, error: '获取提现统计失败' }
  }
}
