'use server'

import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import { TASK_VIDEOS } from '@/lib/config'
import { generatePrivateUrl } from '@/lib/qiniu'

// 获取任务提交记录
export async function getTaskSubmission(teacherId: string, taskIndex: number) {
  try {
    const submission = await prisma.taskSubmission.findUnique({
      where: {
        teacherId_taskIndex: {
          teacherId,
          taskIndex
        }
      }
    })
    
    return submission
  } catch (error) {
    console.error('获取任务提交记录失败:', error)
    return null
  }
}

// 创建或更新任务提交
export async function submitTask(
  teacherId: string,
  taskIndex: number,
  data: {
    taskType: string
    formData?: any
    textContent?: string
    watchProgress?: number
  }
) {
  try {
    // 调试日志：记录接收到的数据
    console.log('📝 提交任务数据:', { 
      teacherId, 
      taskIndex, 
      taskType: data.taskType,
      hasFormData: !!data.formData,
      formData: data.formData,
      watchProgress: data.watchProgress
    })
    
    // 验证 teacherId 是否存在
    const teacher = await prisma.teacher.findUnique({
      where: { id: teacherId }
    })
    
    if (!teacher) {
      throw new Error(`教师 ID ${teacherId} 不存在`)
    }
    
    // 所有任务类型都自动完成，不需要审核
    const initialStatus = 'COMPLETED'
    
    // 检查是否已存在提交记录
    const existing = await prisma.taskSubmission.findUnique({
      where: {
        teacherId_taskIndex: {
          teacherId,
          taskIndex
        }
      }
    })
    
    let submission
    
    if (existing) {
      // 更新现有记录
      const { taskType, ...restData } = data
      console.log('💾 准备更新现有记录到数据库:', { 
        teacherId, 
        taskIndex,
        restData 
      })
      submission = await prisma.taskSubmission.update({
        where: {
          teacherId_taskIndex: {
            teacherId,
            taskIndex
          }
        },
        data: {
          ...restData,
          taskType: taskType as any,
          status: initialStatus as any,
          attemptCount: existing.attemptCount + 1,
          updatedAt: new Date()
        }
      })
    } else {
      // 创建新记录
      const { taskType, ...restData } = data
      console.log('💾 准备创建新记录到数据库:', { 
        teacherId, 
        taskIndex,
        restData 
      })
      submission = await prisma.taskSubmission.create({
        data: {
          teacherId,
          taskIndex,
          ...restData,
          taskType: taskType as any,
          status: initialStatus as any
        }
      })
    }
    
    console.log('✅ 任务保存成功:', {
      submissionId: submission.id,
      taskIndex: submission.taskIndex,
      taskType: submission.taskType,
      hasFormData: !!submission.formData,
      formData: submission.formData,
      watchProgress: submission.watchProgress
    })
    
    // 获取任务总数
    const totalTasks = await prisma.taskConfig.count({ where: { isActive: true } })
    const isLastTask = taskIndex === (totalTasks - 1)
    
    if (isLastTask) {
      const teacher = await prisma.teacher.findUnique({
        where: { id: teacherId }
      })
      
      if (teacher && taskIndex >= teacher.currentTaskIndex) {
        await prisma.teacher.update({
          where: { id: teacherId },
          data: {
            currentTaskIndex: taskIndex + 1,
            status: 'COMPLETED'
          }
        })
      }
      
      revalidatePath('/onboarding')
      revalidatePath(`/onboarding/task/${taskIndex}`)
      revalidatePath('/onboarding/complete')
      
      return { success: true, submission }
    }
    
    // 其他任务：如果任务自动完成（不需要审核），则推进到下一个任务
    if (initialStatus === 'COMPLETED') {
      const teacher = await prisma.teacher.findUnique({
        where: { id: teacherId }
      })
      
      // 只有当完成的任务是当前任务或之后的任务时，才推进索引
      if (teacher && taskIndex >= teacher.currentTaskIndex) {
        const nextTaskIndex = taskIndex + 1
        const isAllCompleted = nextTaskIndex >= totalTasks
        
        await prisma.teacher.update({
          where: { id: teacherId },
          data: {
            currentTaskIndex: nextTaskIndex,
            status: isAllCompleted ? 'COMPLETED' : 'IN_PROGRESS'
          }
        })
      }
    }
    
    revalidatePath('/onboarding')
    revalidatePath(`/onboarding/task/${taskIndex}`)
    revalidatePath('/onboarding/complete')
    
    return { success: true, submission }
  } catch (error) {
    console.error('提交任务失败:', error)
    return { success: false, error: '提交失败,请重试' }
  }
}

// 更新任务状态
export async function updateTaskStatus(
  teacherId: string,
  taskIndex: number,
  status: string,
  feedback?: string
) {
  try {
    const submission = await prisma.taskSubmission.update({
      where: {
        teacherId_taskIndex: {
          teacherId,
          taskIndex
        }
      },
      data: {
        status: status as any,
        feedback,
        reviewedAt: new Date()
      }
    })
    
    revalidatePath('/onboarding')
    revalidatePath(`/onboarding/task/${taskIndex}`)
    revalidatePath('/admin/review')
    
    return { success: true, submission }
  } catch (error) {
    console.error('更新任务状态失败:', error)
    return { success: false, error: '更新失败,请重试' }
  }
}

// 标记任务为进行中
export async function startTask(teacherId: string, taskIndex: number, taskType: string) {
  try {
    // 检查是否已存在
    const existing = await prisma.taskSubmission.findUnique({
      where: {
        teacherId_taskIndex: {
          teacherId,
          taskIndex
        }
      }
    })
    
    if (existing) {
      return { success: true, submission: existing }
    }
    
    // 创建新的任务记录
    const submission = await prisma.taskSubmission.create({
      data: {
        teacherId,
        taskIndex,
        taskType: taskType as any,
        status: 'IN_PROGRESS' as any
      }
    })
    
    revalidatePath('/onboarding')
    return { success: true, submission }
  } catch (error) {
    console.error('开始任务失败:', error)
    return { success: false, error: '操作失败,请重试' }
  }
}

// 获取所有待审核的任务
export async function getPendingReviews() {
  try {
    const submissions = await prisma.taskSubmission.findMany({
      where: {
        status: 'PENDING_FEEDBACK'
      },
      include: {
        teacher: true
      },
      orderBy: {
        createdAt: 'asc'
      }
    })
    
    return submissions
  } catch (error) {
    console.error('获取待审核任务失败:', error)
    return []
  }
}

// 获取任务的所有视频配置
export async function getTaskVideos(taskIndex: number) {
  try {
    const videos = TASK_VIDEOS[taskIndex]
    
    if (!videos || videos.length === 0) {
      return { success: false, error: '该任务没有配置视频' }
    }
    
    return { success: true, videos }
  } catch (error) {
    console.error('获取视频配置失败:', error)
    return { success: false, error: '获取视频配置失败,请重试' }
  }
}

// 获取指定视频的 URL（带七牛云签名）
export async function getVideoUrl(taskIndex: number, videoIndex: number = 0) {
  try {
    const videos = TASK_VIDEOS[taskIndex]
    
    if (!videos || videos.length === 0) {
      return { success: false, error: '该任务没有配置视频' }
    }
    
    if (videoIndex < 0 || videoIndex >= videos.length) {
      return { success: false, error: '视频索引无效' }
    }
    
    const video = videos[videoIndex]
    
    // 生成带签名的私有下载 URL（1小时有效期）
    const videoUrl = generatePrivateUrl(video.key)
    
    return { 
      success: true, 
      videoUrl,
      videoInfo: video
    }
  } catch (error) {
    console.error('获取视频 URL 失败:', error)
    return { success: false, error: '获取视频失败,请重试' }
  }
}
