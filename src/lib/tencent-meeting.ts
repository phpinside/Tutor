import 'server-only'

import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client'

const DEFAULT_MCP_URL = 'https://mcp.meeting.tencent.com/mcp/wemeet-open/v1'
const DEFAULT_SKILL_VERSION = 'v1.0.14'
const REQUEST_TIMEOUT_MS = 20_000

type JsonObject = Record<string, unknown>

export type ScheduledMeeting = {
  meetingId: string
  meetingCode: string
  subject: string
  startTime: string
  endTime: string
  joinUrl: string
  password: string | null
}

export type RecordingAddress = {
  meetingRecordId: string
  viewAddress: string
}

export class TencentMeetingError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'TencentMeetingError'
  }
}

function isObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function getString(object: JsonObject, ...keys: string[]): string {
  for (const key of keys) {
    const value = object[key]
    if (typeof value === 'string' && value.trim()) return value.trim()
    if (typeof value === 'number') return String(value)
  }
  return ''
}

function findArrayContaining(value: unknown, keys: string[], depth = 0): JsonObject[] | null {
  if (depth > 5) return null
  if (Array.isArray(value)) {
    const objects = value.filter(isObject)
    if (objects.some((item) => keys.some((key) => key in item))) return objects
    for (const item of value) {
      const nested = findArrayContaining(item, keys, depth + 1)
      if (nested) return nested
    }
  } else if (isObject(value)) {
    for (const nestedValue of Object.values(value)) {
      const nested = findArrayContaining(nestedValue, keys, depth + 1)
      if (nested) return nested
    }
  }
  return null
}

function parseTextPayload(text: string): unknown {
  const trimmed = text.trim()
  if (!trimmed) return null

  try {
    return JSON.parse(trimmed)
  } catch {
    const start = trimmed.indexOf('{')
    const end = trimmed.lastIndexOf('}')
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(trimmed.slice(start, end + 1))
      } catch {
        // Continue to the normalized error below.
      }
    }
  }

  return { message: trimmed }
}

function decodeJsonString(value: unknown): unknown {
  if (typeof value !== 'string') return value
  const trimmed = value.trim()
  if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) return value
  try {
    return JSON.parse(trimmed)
  } catch {
    return value
  }
}

/**
 * 腾讯会议 MCP 的 structuredContent 使用 HTTP 代理包装：
 * { data: { status_code, headers, body: "{...}" } }。
 * 业务字段位于二次 JSON 编码的 body 中，统一在这里解包。
 */
function unwrapTencentMeetingPayload(payload: unknown): unknown {
  let current = decodeJsonString(payload)

  for (let depth = 0; depth < 4 && isObject(current); depth += 1) {
    const data = current.data
    if (isObject(data) && 'body' in data) {
      const statusCode = typeof data.status_code === 'number' ? data.status_code : 200
      const body = decodeJsonString(data.body)
      if (statusCode >= 400) {
        throw new TencentMeetingError(resultMessage(body) || `腾讯会议请求失败（${statusCode}）`)
      }
      current = body
      continue
    }

    if ('body' in current && ('status_code' in current || 'statusCode' in current)) {
      const rawStatusCode = current.status_code ?? current.statusCode
      const statusCode = typeof rawStatusCode === 'number' ? rawStatusCode : 200
      const body = decodeJsonString(current.body)
      if (statusCode >= 400) {
        throw new TencentMeetingError(resultMessage(body) || `腾讯会议请求失败（${statusCode}）`)
      }
      current = body
      continue
    }
    break
  }

  return current
}

function resultMessage(payload: unknown): string {
  if (isObject(payload)) {
    return getString(payload, 'message', 'error_message', 'error', 'msg')
  }
  return typeof payload === 'string' ? payload : ''
}

function toPublicError(error: unknown): TencentMeetingError {
  if (error instanceof TencentMeetingError) return error
  const message = error instanceof Error ? error.message : ''
  if (/401|unauthorized|token|鉴权|认证/i.test(message)) {
    return new TencentMeetingError('腾讯会议服务鉴权失败，请联系管理员检查 Token 配置')
  }
  if (/timeout|timed out|abort/i.test(message)) {
    return new TencentMeetingError('腾讯会议服务响应超时，请稍后重试')
  }
  return new TencentMeetingError('腾讯会议服务暂时不可用，请稍后重试')
}

async function callTencentMeetingTool(toolName: string, args: JsonObject): Promise<unknown> {
  const token = process.env.TENCENT_MEETING_TOKEN?.trim()
  if (!token) {
    throw new TencentMeetingError('腾讯会议服务尚未配置，请联系管理员')
  }

  const client = new Client({ name: 'tutor-onboarding', version: '1.0.0' })
  const transport = new StreamableHTTPClientTransport(
    new URL(process.env.TENCENT_MEETING_MCP_URL?.trim() || DEFAULT_MCP_URL),
    {
      requestInit: {
        headers: {
          'X-Tencent-Meeting-Token': token,
          'X-Skill-Version': process.env.TENCENT_MEETING_SKILL_VERSION?.trim() || DEFAULT_SKILL_VERSION,
        },
      },
    }
  )

  try {
    await client.connect(transport, { timeout: REQUEST_TIMEOUT_MS })
    const result = await client.callTool(
      {
        name: toolName,
        arguments: {
          ...args,
          _client_info: {
            os: 'Linux',
            agent: 'Tutor Onboarding',
            model: 'server-action',
          },
        },
      },
      { timeout: REQUEST_TIMEOUT_MS }
    )

    const text = result.content
      .filter((item): item is typeof item & { type: 'text'; text: string } => item.type === 'text')
      .map((item) => item.text)
      .join('\n')
    const rawPayload = result.structuredContent !== undefined
      ? result.structuredContent
      : parseTextPayload(text)
    const payload = unwrapTencentMeetingPayload(rawPayload)

    if (result.isError) {
      throw new TencentMeetingError(resultMessage(payload) || '腾讯会议操作失败')
    }
    return payload
  } catch (error) {
    throw toPublicError(error)
  } finally {
    await client.close().catch(() => undefined)
  }
}

function extractMeeting(payload: unknown, meetingCode?: string): JsonObject | null {
  const meetings = findArrayContaining(payload, ['meeting_id', 'meetingId', 'meeting_code', 'meetingCode'])
  if (!meetings?.length) return null
  if (!meetingCode) return meetings[0]
  return meetings.find((meeting) => getString(meeting, 'meeting_code', 'meetingCode') === meetingCode) ?? meetings[0]
}

export async function scheduleTencentMeeting(input: {
  subject: string
  startTime: string
  endTime: string
  password?: string
}): Promise<ScheduledMeeting> {
  const payload = await callTencentMeetingTool('schedule_meeting', {
    subject: input.subject,
    start_time: input.startTime,
    end_time: input.endTime,
    password: input.password || undefined,
    time_zone: 'Asia/Shanghai',
    meeting_type: 0,
    only_user_join_type: 1,
    auto_in_waiting_room: false,
    auto_record_type: 'cloud',
  })

  let meeting = extractMeeting(payload)
  const meetingCode = meeting ? getString(meeting, 'meeting_code', 'meetingCode') : ''
  let meetingId = meeting ? getString(meeting, 'meeting_id', 'meetingId') : ''

  if (!meetingId && meetingCode) {
    const detailPayload = await callTencentMeetingTool('get_meeting_by_code', {
      meeting_code: meetingCode,
      is_compact: false,
      timezone: 'Asia/Shanghai',
    })
    meeting = extractMeeting(detailPayload, meetingCode) ?? meeting
    meetingId = meeting ? getString(meeting, 'meeting_id', 'meetingId') : ''
  }

  if (!meeting || !meetingId || !meetingCode) {
    throw new TencentMeetingError('会议已提交，但腾讯会议未返回完整信息，请联系管理员核查')
  }

  const joinUrl = getString(meeting, 'join_url', 'joinUrl')
  if (!joinUrl) throw new TencentMeetingError('腾讯会议未返回加入链接，请稍后重试')

  return {
    meetingId,
    meetingCode,
    subject: getString(meeting, 'subject') || input.subject,
    startTime: getString(meeting, 'start_time', 'startTime') || input.startTime,
    endTime: getString(meeting, 'end_time', 'endTime') || input.endTime,
    joinUrl,
    password: getString(meeting, 'password') || input.password || null,
  }
}

export async function updateTencentMeetingRemote(input: {
  meetingId: string
  subject: string
  startTime: string
  endTime: string
  password?: string
}): Promise<void> {
  await callTencentMeetingTool('update_meeting', {
    meeting_id: input.meetingId,
    subject: input.subject,
    start_time: input.startTime,
    end_time: input.endTime,
    password: input.password ?? '',
    time_zone: 'Asia/Shanghai',
    meeting_type: 0,
    auto_record_type: 'cloud',
    is_compact: true,
  })
}

export async function cancelTencentMeetingRemote(meetingId: string): Promise<void> {
  await callTencentMeetingTool('cancel_meeting', {
    meeting_id: meetingId,
    is_compact: true,
    timezone: 'Asia/Shanghai',
  })
}

export async function getTencentMeetingRecording(input: {
  meetingId: string
  meetingCode: string
  startTime: string
  endTime: string
}): Promise<RecordingAddress | null> {
  const listPayload = await callTencentMeetingTool('get_records_list', {
    meeting_id: input.meetingId,
    meeting_code: input.meetingCode,
    start_time: input.startTime,
    end_time: input.endTime,
    page_size: 30,
    is_compact: false,
    timezone: 'Asia/Shanghai',
  })
  const records = findArrayContaining(listPayload, ['record_id', 'meeting_record_id', 'recordId'])
  const matchingRecord = records?.find((record) => {
    const recordMeetingId = getString(record, 'meeting_id', 'meetingId')
    return !recordMeetingId || recordMeetingId === input.meetingId
  })
  if (!matchingRecord) return null

  const meetingRecordId = getString(matchingRecord, 'meeting_record_id', 'record_id', 'recordId')
  if (!meetingRecordId) return null

  const addressPayload = await callTencentMeetingTool('get_record_addresses', {
    meeting_record_id: meetingRecordId,
    page_size: 30,
    is_compact: false,
    timezone: 'Asia/Shanghai',
  })
  const files = findArrayContaining(addressPayload, ['view_address', 'viewAddress'])
  const viewAddress = files
    ?.map((file) => getString(file, 'view_address', 'viewAddress'))
    .find(Boolean)

  return viewAddress ? { meetingRecordId, viewAddress } : null
}
