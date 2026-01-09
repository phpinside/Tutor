'use server'

import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'

// 获取系统配置
export async function getSystemConfig(key: string, defaultValue: number = 0): Promise<number> {
  try {
    const config = await prisma.systemConfig.findUnique({
      where: { key }
    })
    
    if (!config) {
      // 如果配置不存在，创建默认配置
      await prisma.systemConfig.create({
        data: {
          key,
          value: defaultValue.toString()
        }
      })
      return defaultValue
    }
    
    return parseFloat(config.value)
  } catch (error) {
    console.error(`获取系统配置 ${key} 失败:`, error)
    return defaultValue
  }
}

// 获取所有奖励配置
export async function getRewardConfigs() {
  try {
    const configs = await prisma.systemConfig.findMany({
      where: {
        key: {
          in: ['DIRECT_REWARD', 'INDIRECT_REWARD']
        }
      }
    })
    
    const configMap: Record<string, number> = {}
    configs.forEach(config => {
      configMap[config.key] = parseFloat(config.value)
    })
    
    // 如果配置不存在，使用默认值
    const directReward = configMap['DIRECT_REWARD'] ?? 10
    const indirectReward = configMap['INDIRECT_REWARD'] ?? 5
    
    return {
      success: true,
      configs: {
        directReward,
        indirectReward
      }
    }
  } catch (error) {
    console.error('获取奖励配置失败:', error)
    return { success: false, error: '获取奖励配置失败' }
  }
}

// 更新系统配置
export async function updateSystemConfig(key: string, value: number) {
  try {
    await prisma.systemConfig.upsert({
      where: { key },
      create: {
        key,
        value: value.toString()
      },
      update: {
        value: value.toString()
      }
    })
    
    revalidatePath('/admin/config/rewards')
    
    return { success: true }
  } catch (error) {
    console.error(`更新系统配置 ${key} 失败:`, error)
    return { success: false, error: '更新配置失败' }
  }
}

// 批量更新奖励配置
export async function updateRewardConfigs(configs: {
  directReward: number
  indirectReward: number
}) {
  try {
    if (configs.directReward < 0 || configs.indirectReward < 0) {
      return { success: false, error: '奖励金额不能为负数' }
    }
    
    await Promise.all([
      updateSystemConfig('DIRECT_REWARD', configs.directReward),
      updateSystemConfig('INDIRECT_REWARD', configs.indirectReward)
    ])
    
    revalidatePath('/admin/config/rewards')
    revalidatePath('/referral/dashboard')
    
    return { success: true }
  } catch (error) {
    console.error('更新奖励配置失败:', error)
    return { success: false, error: '更新奖励配置失败' }
  }
}

// 初始化默认配置
export async function initializeDefaultConfigs() {
  try {
    const defaultConfigs = [
      { key: 'DIRECT_REWARD', value: '10' },
      { key: 'INDIRECT_REWARD', value: '5' }
    ]
    
    for (const config of defaultConfigs) {
      await prisma.systemConfig.upsert({
        where: { key: config.key },
        create: config,
        update: {}  // 如果已存在，不更新
      })
    }
    
    return { success: true }
  } catch (error) {
    console.error('初始化默认配置失败:', error)
    return { success: false, error: '初始化失败' }
  }
}
