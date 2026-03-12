'use server'

import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'

// ==================== 任务配置管理 ====================

// 获取所有任务配置
export async function getAllTaskConfigs() {
  try {
    const configs = await prisma.taskConfig.findMany({
      orderBy: [
        { sortOrder: 'asc' },
        { index: 'asc' }
      ]
    })
    return configs
  } catch (error) {
    console.error('获取任务配置失败:', error)
    return []
  }
}

// 获取单个任务配置
export async function getTaskConfig(id: string) {
  try {
    const config = await prisma.taskConfig.findUnique({
      where: { id }
    })
    return config
  } catch (error) {
    console.error('获取任务配置失败:', error)
    return null
  }
}

// 创建任务配置
export async function createTaskConfig(data: {
  index: number
  title: string
  phase: number
  emoji: string
  type: string
  description: string
  estimatedMinutes: number
  isOptional: boolean
  requirements: string[]
  questions?: object[]
}) {
  try {
    const config = await prisma.taskConfig.create({
      data: {
        ...data,
        type: data.type as any,
        requirements: data.requirements,
        questions: data.questions ?? undefined
      }
    })
    
    revalidatePath('/admin/config')
    revalidatePath('/onboarding')
    return { success: true, config }
  } catch (error) {
    console.error('创建任务配置失败:', error)
    return { success: false, error: '创建失败,请检查索引是否重复' }
  }
}

// 更新任务配置
export async function updateTaskConfig(id: string, data: {
  index?: number
  title?: string
  phase?: number
  emoji?: string
  type?: string
  description?: string
  estimatedMinutes?: number
  isOptional?: boolean
  requirements?: string[]
  questions?: object[]
  isActive?: boolean
  sortOrder?: number
}) {
  try {
    const updateData: any = { ...data }
    if (data.type) {
      updateData.type = data.type as any
    }
    
    const config = await prisma.taskConfig.update({
      where: { id },
      data: updateData
    })
    
    revalidatePath('/admin/config')
    revalidatePath('/onboarding')
    return { success: true, config }
  } catch (error) {
    console.error('更新任务配置失败:', error)
    return { success: false, error: '更新失败,请检查数据是否有效' }
  }
}

// 删除任务配置
export async function deleteTaskConfig(id: string) {
  try {
    await prisma.taskConfig.delete({
      where: { id }
    })
    
    revalidatePath('/admin/config')
    revalidatePath('/onboarding')
    return { success: true }
  } catch (error) {
    console.error('删除任务配置失败:', error)
    return { success: false, error: '删除失败' }
  }
}

// 批量更新任务排序
export async function updateTaskConfigOrders(updates: { id: string; sortOrder: number }[]) {
  try {
    await prisma.$transaction(
      updates.map(({ id, sortOrder }) =>
        prisma.taskConfig.update({
          where: { id },
          data: { sortOrder }
        })
      )
    )
    
    revalidatePath('/admin/config')
    revalidatePath('/onboarding')
    return { success: true }
  } catch (error) {
    console.error('更新排序失败:', error)
    return { success: false, error: '更新排序失败' }
  }
}

// ==================== 阶段配置管理 ====================

// 获取所有阶段配置
export async function getAllPhaseConfigs() {
  try {
    const configs = await prisma.phaseConfig.findMany({
      orderBy: [
        { sortOrder: 'asc' },
        { phase: 'asc' }
      ]
    })
    return configs
  } catch (error) {
    console.error('获取阶段配置失败:', error)
    return []
  }
}

// 创建阶段配置
export async function createPhaseConfig(data: {
  phase: number
  title: string
  description: string
}) {
  try {
    const config = await prisma.phaseConfig.create({
      data
    })
    
    revalidatePath('/admin/config')
    revalidatePath('/onboarding')
    return { success: true, config }
  } catch (error) {
    console.error('创建阶段配置失败:', error)
    return { success: false, error: '创建失败,请检查阶段号是否重复' }
  }
}

// 更新阶段配置
export async function updatePhaseConfig(id: string, data: {
  phase?: number
  title?: string
  description?: string
  sortOrder?: number
  isActive?: boolean
}) {
  try {
    const config = await prisma.phaseConfig.update({
      where: { id },
      data
    })
    
    revalidatePath('/admin/config')
    revalidatePath('/onboarding')
    return { success: true, config }
  } catch (error) {
    console.error('更新阶段配置失败:', error)
    return { success: false, error: '更新失败' }
  }
}

// 删除阶段配置
export async function deletePhaseConfig(id: string) {
  try {
    await prisma.phaseConfig.delete({
      where: { id }
    })
    
    revalidatePath('/admin/config')
    revalidatePath('/onboarding')
    return { success: true }
  } catch (error) {
    console.error('删除阶段配置失败:', error)
    return { success: false, error: '删除失败' }
  }
}

