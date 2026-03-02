'use server'

import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'

/**
 * 评估教师资格
 * 根据高考数学成绩判断是否通过评估
 * >= 100 分通过，< 100 分不通过
 */
export async function evaluateTeacher(teacherId: string) {
  try {
    // 获取教师信息
    const teacher = await prisma.teacher.findUnique({
      where: { id: teacherId }
    })

    if (!teacher) {
      return { 
        success: false, 
        error: '教师信息不存在' 
      }
    }

    // 解析数学成绩
    const mathScore = teacher.mathScore ?? 0
    
    // 判断是否通过评估
    const passed = mathScore >= 100
    
    // 只有通过评估才更新数据库状态
    // 未通过的状态通过 localStorage 在前端处理
    if (passed) {
      await prisma.teacher.update({
        where: { id: teacherId },
        data: { status: 'COMPLETED' }
      })
    }

    // 重新验证相关页面
    revalidatePath('/onboarding')
    revalidatePath('/onboarding/evaluation')
    revalidatePath('/onboarding/complete')

    return {
      success: true,
      passed,
      mathScore
    }
  } catch (error) {
    console.error('评估教师失败:', error)
    return {
      success: false,
      error: '评估失败，请重试'
    }
  }
}

/**
 * 获取评估状态
 * 用于检查教师当前的评估状态
 */
export async function getEvaluationStatus(teacherId: string) {
  try {
    const teacher = await prisma.teacher.findUnique({
      where: { id: teacherId },
      select: {
        status: true,
        mathScore: true
      }
    })

    if (!teacher) {
      return {
        success: false,
        error: '教师信息不存在'
      }
    }

    return {
      success: true,
      status: teacher.status,
      mathScore: teacher.mathScore
    }
  } catch (error) {
    console.error('获取评估状态失败:', error)
    return {
      success: false,
      error: '获取状态失败'
    }
  }
}
