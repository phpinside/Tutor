import { NextRequest, NextResponse } from 'next/server'
import { getAllReferrals, markTeachingCompleted } from '@/app/actions/referral'
import { prisma } from '@/lib/prisma'

// 外部 API 配置
const API_URL = process.env.EXTERNAL_TUTOR_API_URL || 'https://flowapi.chulu.net/v1/external/tutors/info'
const API_TOKEN = process.env.EXTERNAL_TUTOR_API_TOKEN
const CRON_SECRET = process.env.CRON_SECRET

// 调用外部 API 获取伴学教练信息
async function getTutorInfo(phone: string, tutorId: string): Promise<{
  success: boolean
  data?: {
    name: string
    phone: string
    tutorId: string
    managerPhone: string
    regularLessonHours: number
  }
  error?: string
  message?: string
} | null> {
  // 检查环境变量
  if (!API_TOKEN) {
    console.error('EXTERNAL_TUTOR_API_TOKEN 环境变量未设置')
    return { success: false, error: 'API Token 未配置' }
  }

  try {
    const url = new URL(API_URL)
    url.searchParams.set('phone', phone)
    //url.searchParams.set('tutorId', tutorId)
    //暂时不能传递tutorId，否则接口会没数据

    console.log('调用外部API:', url.toString())

    const response = await fetch(url.toString(), {
      method: 'GET',
      redirect: 'follow',
      headers: {
        'X-External-Token': API_TOKEN || '',
        'Accept': '*/*',
        'User-Agent': 'TutorOnboarding/1.0.0',
        'X-Forwarded-Proto': 'https',
      },
    })

    // 打印curl请求
    console.log(`curl -X GET -H "X-External-Token: ${API_TOKEN}" ${API_URL}?phone=${phone}&tutorId=${tutorId}`)

    if (!response.ok) {
      const errorText = await response.text().catch(() => '无法读取错误信息')
      console.error(`外部API调用失败: ${response.status} ${response.statusText}`)
      console.error(`错误响应: ${errorText}`)
      return { success: false, error: `HTTP ${response.status}: ${response.statusText}` }
    }

    const data = await response.json()
    console.log(`API响应成功:`, JSON.stringify(data))
    return data
  } catch (error) {
    if (error instanceof Error) {
      console.error('错误详情:', error.message)
      console.error('错误堆栈:', error.stack)
    }
    return { success: false, error: error instanceof Error ? error.message : String(error) }
  }
}

// 主处理函数：检查并标记授课完成
async function checkAndMarkTeachingCompleted(): Promise<{
  processed: number
  marked: number
  success: string[]     // 成功标记的记录
  failed: string[]      // 失败的记录
  insufficient: string[] // 课时不足的记录
}> {
  let processed = 0
  let marked = 0
  const success: string[] = []
  const failed: string[] = []
  const insufficient: string[] = []

  // 用于跟踪已处理的被邀请人，避免重复调用外部 API
  const processedReferredIds = new Set<string>()

  try {
    let page = 1
    const pageSize = 50
    let hasMore = true

    while (hasMore) {
      const result = await getAllReferrals(
        {
          status: 'VALID',
          teachingStatus: 'not_taught',
        },
        page,
        pageSize
      )

      if (!result.success || !result.referrals) {
        failed.push(`获取第${page}页邀请记录失败`)
        break
      }

      const referrals = result.referrals

      if (referrals.length === 0) {
        hasMore = false
        break
      }

      for (const referral of referrals) {
        // 跳过已处理的被邀请人
        if (processedReferredIds.has(referral.referred.id)) {
          continue
        }

        processed++
        processedReferredIds.add(referral.referred.id)

        const { referred } = referral
        if (!referred.phone) {
          failed.push(`标记失败: ${referred.name}(${referred.phone}), 原因: 手机号为空`)
          continue
        }

        // 调用外部 API 获取课时信息
        const tutorInfo = await getTutorInfo(referred.phone, referred.id)

        if (!tutorInfo || !tutorInfo.success) {
          // API 调用失败，记录错误但不中断
          failed.push(`标记失败: ${referred.name}(${referred.phone}), 原因: ${tutorInfo?.error || tutorInfo?.message || '获取伴学教练信息失败'}`)
          continue
        }

        const regularLessonHours = tutorInfo.data?.regularLessonHours || 0

        // 检查是否满足完成授课条件（>= 10课时）
        if (regularLessonHours >= 10) {
          // 找到该被邀请人的所有邀请记录（包括直接和间接）
          const allReferrals = await prisma.referral.findMany({
            where: {
              referredId: referred.id,
              status: 'VALID',
            },
            select: { id: true },
          })

         // 批量标记所有相关邀请记录
          for (const r of allReferrals) {
            
            const markResult = await markTeachingCompleted(
              r.id,
              `系统检测：已完成${regularLessonHours}课时`,
              '系统自动检测'
            )

            if (markResult.success) {

              marked++
              success.push(`已标记授课完成: ${referred.name}(${referred.phone}), 课时数: ${regularLessonHours}`)

            } else {

              failed.push(`邀请记录 ${r.id}: 标记授课完成失败 - ${markResult.error}`)
            }
          }

        } else {
          // 课时不足，记录但不标记
          insufficient.push(`课时不足: ${referred.name}(${referred.phone}), 当前课时: ${regularLessonHours}`)
        }
      }

      // 检查是否还有更多数据
      const totalCount = result.totalCount || 0
      hasMore = page * pageSize < totalCount
      page++

    }

  } catch (error) {
    failed.push(`处理异常: ${error instanceof Error ? error.message : String(error)}`)
  }

  return { processed, marked, success, failed, insufficient }
}

// 验证 Cron Secret
function verifyCronSecret(request: NextRequest): boolean {
  if (!CRON_SECRET) {
    // 如果没有配置 secret，在生产环境中应该拒绝请求
    // 但在开发环境中可以允许
    return process.env.NODE_ENV === 'development'
  }

  const authHeader = request.headers.get('authorization')
  if (authHeader === `Bearer ${CRON_SECRET}`) {
    return true
  }

  // Vercel Cron 会发送这个 header
  const cronAuth = request.headers.get('x-vercel-cron-secret')
  if (cronAuth === CRON_SECRET) {
    return true
  }

  return false
}

// GET 处理函数
export async function GET(request: NextRequest) {
  // 验证请求来源
  if (!verifyCronSecret(request)) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 }
    )
  }

  console.log('开始执行授课状态检查任务...', new Date().toISOString())

  const result = await checkAndMarkTeachingCompleted()

  console.log('授课状态检查任务完成:', {
    processed: result.processed,
    marked: result.marked,
    success: result.success.length,
    failed: result.failed.length,
    insufficient: result.insufficient.length,
  })

  return NextResponse.json({
    success: true,
    data: {
      processed: result.processed,
      marked: result.marked,
      success: result.success,
      failed: result.failed,
      insufficient: result.insufficient,
      timestamp: new Date().toISOString(),
    },
  })
}

// 允许 POST 方法（用于手动触发测试）
export async function POST(request: NextRequest) {
  return GET(request)
}
