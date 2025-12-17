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
  name?: string
  school?: string
  major?: string
  gradePreference?: string
  availableTime?: string
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


