const MANAGERS_API_URL =
  process.env.EXTERNAL_MANAGER_API_URL ||
  'https://flowapi.chulu.net/v1/external/tutors/managers'
const API_TOKEN = process.env.EXTERNAL_TUTOR_API_TOKEN
const REQUEST_TIMEOUT_MS = 30_000

export interface ExternalManager {
  name: string
  phone: string
  positionCode?: string
  positionName?: string
}

export interface FetchExternalManagersResult {
  success: boolean
  managers: ExternalManager[]
  total?: number
  error?: string
}

type ManagersApiResponse = {
  success?: boolean
  data?: {
    total?: number
    managers?: Array<{
      name?: string
      phone?: string
      positionCode?: string
      positionName?: string
    }>
  }
  error?: string
  message?: string
} | null

export async function fetchExternalManagers(): Promise<FetchExternalManagersResult> {
  if (!API_TOKEN) {
    console.error('EXTERNAL_TUTOR_API_TOKEN 环境变量未设置')
    return { success: false, managers: [], error: 'API Token 未配置' }
  }

  try {
    const response = await fetch(MANAGERS_API_URL, {
      method: 'GET',
      redirect: 'follow',
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      headers: {
        'X-External-Token': API_TOKEN,
        Accept: '*/*',
        'User-Agent': 'TutorOnboarding/1.0.0',
      },
    })

    if (!response.ok) {
      const errorText = await response.text().catch(() => '无法读取错误信息')
      console.error(`外部学管名单API调用失败: ${response.status} ${response.statusText}`)
      console.error(`错误响应: ${errorText}`)
      return {
        success: false,
        managers: [],
        error: `HTTP ${response.status}: ${response.statusText}`,
      }
    }

    const data: ManagersApiResponse = await response.json()
    if (!data?.success || !Array.isArray(data.data?.managers)) {
      return {
        success: false,
        managers: [],
        error: data?.error || data?.message || '外部接口返回数据格式异常',
      }
    }

    const managers: ExternalManager[] = []
    for (const item of data.data.managers) {
      if (!item?.name?.trim() || !item?.phone?.trim()) {
        console.warn('外部学管名单存在缺失姓名或手机号的记录，已跳过:', JSON.stringify(item))
        continue
      }
      managers.push({
        name: item.name.trim(),
        phone: item.phone.trim(),
        positionCode: item.positionCode,
        positionName: item.positionName,
      })
    }

    return { success: true, managers, total: data.data.total ?? managers.length }
  } catch (error) {
    if (error instanceof Error) {
      console.error('外部学管名单API调用异常:', error.message)
      console.error('错误堆栈:', error.stack)
    }
    return {
      success: false,
      managers: [],
      error: error instanceof Error ? error.message : String(error),
    }
  }
}
