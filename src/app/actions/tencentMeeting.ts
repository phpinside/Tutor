'use server'

import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import {
  cancelTencentMeetingRemote,
  getTencentMeetingRecording,
  scheduleTencentMeeting,
  TencentMeetingError,
  updateTencentMeetingRemote,
} from '@/lib/tencent-meeting'

const meetingInputSchema = z.object({
  subject: z.string().trim().min(1, '请输入会议主题').max(100, '会议主题不能超过100个字'),
  startTime: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, '开始时间格式不正确'),
  endTime: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, '结束时间格式不正确'),
  password: z.string().trim().optional().default(''),
})

export type TencentMeetingInput = z.input<typeof meetingInputSchema>

type ActionResult = {
  success: boolean
  error?: string
  message?: string
  bookingId?: string
  notReady?: boolean
}

function parseBeijingDate(value: string): Date {
  return new Date(`${value}:00+08:00`)
}

function toBeijingIso(date: Date): string {
  return new Date(date.getTime() + 8 * 60 * 60 * 1000)
    .toISOString()
    .replace('Z', '+08:00')
}

function publicError(error: unknown, fallback: string): string {
  if (error instanceof TencentMeetingError) return error.message
  return fallback
}

function formatBeijingDateTime(date: Date): string {
  return new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date)
}

async function findConflictingMeeting(start: Date, end: Date, excludeBookingId?: string) {
  return prisma.tencentMeetingBooking.findFirst({
    where: {
      status: 'SCHEDULED',
      startTime: { lt: end },
      endTime: { gt: start },
      ...(excludeBookingId ? { id: { not: excludeBookingId } } : {}),
    },
    orderBy: { startTime: 'asc' },
    select: {
      subject: true,
      startTime: true,
      endTime: true,
    },
  })
}

function meetingConflictError(conflict: {
  subject: string
  startTime: Date
  endTime: Date
}): ActionResult {
  return {
    success: false,
    error: `与「${conflict.subject}」（${formatBeijingDateTime(conflict.startTime)}—${formatBeijingDateTime(conflict.endTime)}）时间冲突，请调整会议时间`,
  }
}

type MeetingStaff = {
  creatorType: 'OPERATOR' | 'ADMIN'
  creatorId: string
  creatorName: string
}

async function currentMeetingStaff(): Promise<MeetingStaff | null> {
  const cookieStore = await cookies()
  const operatorSession = cookieStore.get('operator_session')?.value
  if (operatorSession) {
    try {
      const data = JSON.parse(operatorSession) as { operatorId?: string; name?: string }
      if (data.operatorId) {
        const operator = await prisma.operator.findFirst({
          where: { id: data.operatorId, isEnabled: true },
          select: { id: true, name: true },
        })
        if (operator) {
          return {
            creatorType: 'OPERATOR',
            creatorId: operator.id,
            creatorName: operator.name,
          }
        }
      }
    } catch {}
  }

  const adminSession = cookieStore.get('admin_session')?.value
  if (!adminSession) return null
  try {
    const data = JSON.parse(adminSession) as { authenticated?: boolean; role?: string }
    if (data.authenticated && data.role === 'super_admin') {
      return {
        creatorType: 'ADMIN',
        creatorId: 'super_admin',
        creatorName: '超级管理员',
      }
    }
  } catch {}
  return null
}

function validateMeetingInput(input: TencentMeetingInput):
  | { success: true; data: { subject: string; startTime: string; endTime: string; password: string; start: Date; end: Date } }
  | { success: false; error: string } {
  const parsed = meetingInputSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message || '会议信息不完整' }
  }
  if (parsed.data.password && !/^\d{4,6}$/.test(parsed.data.password)) {
    return { success: false, error: '会议密码必须是4～6位数字，或留空不设置' }
  }

  const start = parseBeijingDate(parsed.data.startTime)
  const end = parseBeijingDate(parsed.data.endTime)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return { success: false, error: '会议时间格式不正确' }
  }
  const startMinute = Number(parsed.data.startTime.slice(-2))
  const endMinute = Number(parsed.data.endTime.slice(-2))
  if (startMinute % 5 !== 0 || endMinute % 5 !== 0) {
    return { success: false, error: '会议时间请按5分钟为单位选择' }
  }
  if (end.getTime() - start.getTime() < 5 * 60 * 1000) {
    return { success: false, error: '会议时长不能少于5分钟' }
  }

  return { success: true, data: { ...parsed.data, start, end } }
}

function revalidateMeetingPages() {
  revalidatePath('/admin/tencent-meetings')
}

export async function createTencentMeeting(input: TencentMeetingInput): Promise<ActionResult> {
  const staff = await currentMeetingStaff()
  if (!staff) return { success: false, error: '仅运营人员和管理员可预约会议' }

  const validation = validateMeetingInput(input)
  if (!validation.success) return validation
  if (validation.data.start.getTime() <= Date.now()) {
    return { success: false, error: '开始时间必须晚于当前时间' }
  }

  const conflict = await findConflictingMeeting(validation.data.start, validation.data.end)
  if (conflict) return meetingConflictError(conflict)

  try {
    const meeting = await scheduleTencentMeeting({
      subject: validation.data.subject,
      startTime: `${validation.data.startTime}:00+08:00`,
      endTime: `${validation.data.endTime}:00+08:00`,
      password: validation.data.password || undefined,
    })

    try {
      const booking = await prisma.tencentMeetingBooking.create({
        data: {
          teacherId: null,
          creatorType: staff.creatorType,
          creatorId: staff.creatorId,
          creatorName: staff.creatorName,
          meetingId: meeting.meetingId,
          meetingCode: meeting.meetingCode,
          subject: validation.data.subject,
          startTime: validation.data.start,
          endTime: validation.data.end,
          joinUrl: meeting.joinUrl,
          meetingPassword: meeting.password,
        },
        select: { id: true },
      })
      revalidateMeetingPages()
      return { success: true, bookingId: booking.id, message: '会议预约成功' }
    } catch (databaseError) {
      await cancelTencentMeetingRemote(meeting.meetingId).catch(() => undefined)
      throw databaseError
    }
  } catch (error) {
    console.error('[createTencentMeeting]', error instanceof Error ? error.message : 'unknown error')
    return { success: false, error: publicError(error, '预约失败，请稍后重试') }
  }
}

export async function updateTencentMeeting(
  bookingId: string,
  input: TencentMeetingInput
): Promise<ActionResult> {
  const staff = await currentMeetingStaff()
  if (!staff) return { success: false, error: '仅运营人员和管理员可修改会议' }
  const validation = validateMeetingInput(input)
  if (!validation.success) return validation
  if (validation.data.start.getTime() <= Date.now()) {
    return { success: false, error: '开始时间必须晚于当前时间' }
  }

  const booking = await prisma.tencentMeetingBooking.findUnique({ where: { id: bookingId } })
  if (!booking) return { success: false, error: '预约不存在' }
  if (booking.status === 'CANCELLED') return { success: false, error: '已取消的会议不能修改' }
  if (booking.startTime.getTime() <= Date.now()) return { success: false, error: '会议已经开始，不能修改' }

  const conflict = await findConflictingMeeting(validation.data.start, validation.data.end, booking.id)
  if (conflict) return meetingConflictError(conflict)

  try {
    await updateTencentMeetingRemote({
      meetingId: booking.meetingId,
      subject: validation.data.subject,
      startTime: `${validation.data.startTime}:00+08:00`,
      endTime: `${validation.data.endTime}:00+08:00`,
      password: validation.data.password || undefined,
    })
    await prisma.tencentMeetingBooking.update({
      where: { id: booking.id },
      data: {
        subject: validation.data.subject,
        startTime: validation.data.start,
        endTime: validation.data.end,
        meetingPassword: validation.data.password || null,
      },
    })
    revalidateMeetingPages()
    return { success: true, message: '会议修改成功' }
  } catch (error) {
    console.error('[updateTencentMeeting]', error instanceof Error ? error.message : 'unknown error')
    return { success: false, error: publicError(error, '修改失败，请稍后重试') }
  }
}

export async function cancelTencentMeeting(bookingId: string): Promise<ActionResult> {
  const staff = await currentMeetingStaff()
  if (!staff) return { success: false, error: '仅运营人员和管理员可取消会议' }
  const booking = await prisma.tencentMeetingBooking.findUnique({ where: { id: bookingId } })
  if (!booking) return { success: false, error: '预约不存在' }
  if (booking.status === 'CANCELLED') return { success: true, message: '会议已经取消' }
  if (booking.startTime.getTime() <= Date.now()) return { success: false, error: '会议已经开始，不能取消' }

  try {
    await cancelTencentMeetingRemote(booking.meetingId)
    await prisma.tencentMeetingBooking.update({
      where: { id: booking.id },
      data: { status: 'CANCELLED', cancelledAt: new Date() },
    })
    revalidateMeetingPages()
    return { success: true, message: '会议已取消' }
  } catch (error) {
    console.error('[cancelTencentMeeting]', error instanceof Error ? error.message : 'unknown error')
    return { success: false, error: publicError(error, '取消失败，请稍后重试') }
  }
}

export async function syncTencentMeetingRecording(bookingId: string): Promise<ActionResult> {
  const staff = await currentMeetingStaff()
  if (!staff) return { success: false, error: '仅运营人员和管理员可同步录制' }

  const booking = await prisma.tencentMeetingBooking.findUnique({ where: { id: bookingId } })
  if (!booking) return { success: false, error: '预约不存在' }
  if (booking.status === 'CANCELLED') return { success: false, error: '已取消的会议没有录制' }
  if (booking.endTime.getTime() > Date.now()) return { success: false, error: '会议尚未结束' }

  try {
    const recording = await getTencentMeetingRecording({
      meetingId: booking.meetingId,
      meetingCode: booking.meetingCode,
      startTime: toBeijingIso(new Date(booking.startTime.getTime() - 60 * 60 * 1000)),
      endTime: toBeijingIso(new Date()),
    })
    if (!recording) {
      return {
        success: false,
        notReady: true,
        error: '暂未生成云录制，会议结束后通常需要5～30分钟处理，请稍后再试',
      }
    }

    await prisma.tencentMeetingBooking.update({
      where: { id: booking.id },
      data: {
        meetingRecordId: recording.meetingRecordId,
        recordingUrl: recording.viewAddress,
        recordingSyncedAt: new Date(),
      },
    })
    revalidateMeetingPages()
    return { success: true, message: '录制链接已同步' }
  } catch (error) {
    console.error('[syncTencentMeetingRecording]', error instanceof Error ? error.message : 'unknown error')
    return { success: false, error: publicError(error, '同步录制失败，请稍后重试') }
  }
}

export async function setTencentMeetingRecordingPassword(
  bookingId: string,
  password: string
): Promise<ActionResult> {
  const staff = await currentMeetingStaff()
  if (!staff) return { success: false, error: '仅运营人员和管理员可补录访问密码' }
  const normalizedPassword = password.trim()
  if (!/^[A-Za-z0-9]{4,8}$/.test(normalizedPassword)) {
    return { success: false, error: '录制访问密码必须是4～8位字母或数字' }
  }

  const booking = await prisma.tencentMeetingBooking.findUnique({ where: { id: bookingId } })
  if (!booking) return { success: false, error: '预约不存在' }
  if (!booking.recordingUrl) return { success: false, error: '请先同步录制链接' }

  await prisma.tencentMeetingBooking.update({
    where: { id: booking.id },
    data: { recordingPassword: normalizedPassword },
  })
  revalidateMeetingPages()
  return { success: true, message: '录制访问密码已保存' }
}
