'use client'

import { FormEvent, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  cancelTencentMeeting,
  createTencentMeeting,
  setTencentMeetingRecordingPassword,
  syncTencentMeetingRecording,
  type TencentMeetingInput,
  updateTencentMeeting,
} from '@/app/actions/tencentMeeting'

type Booking = {
  id: string
  creatorType: 'TEACHER' | 'OPERATOR' | 'ADMIN'
  creatorName: string
  meetingCode: string
  subject: string
  startTime: string
  endTime: string
  joinUrl: string
  meetingPassword: string | null
  status: 'SCHEDULED' | 'CANCELLED'
  recordingUrl: string | null
  recordingPassword: string | null
  recordingSyncedAt: string | null
}

type BookingViewStatus = 'UPCOMING' | 'ONGOING' | 'ENDED' | 'CANCELLED'

const TAB_LABELS: Record<BookingViewStatus, string> = {
  UPCOMING: '即将开始',
  ONGOING: '进行中',
  ENDED: '已结束',
  CANCELLED: '已取消',
}

const HOUR_OPTIONS = Array.from({ length: 24 }, (_, hour) => String(hour).padStart(2, '0'))
const MINUTE_OPTIONS = Array.from({ length: 12 }, (_, index) => String(index * 5).padStart(2, '0'))

function ChineseDateTimePicker({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (value: string) => void
}) {
  const [date = '', time = '00:00'] = value.split('T')
  const [hour = '00', minute = '00'] = time.split(':')

  const update = (nextDate: string, nextHour: string, nextMinute: string) => {
    if (!nextDate) {
      onChange('')
      return
    }
    onChange(`${nextDate}T${nextHour}:${nextMinute}`)
  }

  return (
    <fieldset>
      <legend className="text-sm font-medium text-gray-700">{label}</legend>
      <div className="mt-1 grid grid-cols-[minmax(0,1fr)_88px_88px] gap-2">
        <input
          type="date"
          lang="zh-CN"
          aria-label={`${label}日期`}
          className="input min-w-0 px-3"
          value={date}
          required
          onChange={(event) => update(event.target.value, hour, minute)}
        />
        <select
          aria-label={`${label}小时`}
          className="input px-2"
          value={hour}
          onChange={(event) => update(date, event.target.value, minute)}
        >
          {HOUR_OPTIONS.map((option) => <option key={option} value={option}>{option}时</option>)}
        </select>
        <select
          aria-label={`${label}分钟`}
          className="input px-2"
          value={minute}
          onChange={(event) => update(date, hour, event.target.value)}
        >
          {MINUTE_OPTIONS.map((option) => <option key={option} value={option}>{option}分</option>)}
        </select>
      </div>
    </fieldset>
  )
}

function getStatus(booking: Booking, now: number): BookingViewStatus {
  if (booking.status === 'CANCELLED') return 'CANCELLED'
  if (now < new Date(booking.startTime).getTime()) return 'UPCOMING'
  if (now < new Date(booking.endTime).getTime()) return 'ONGOING'
  return 'ENDED'
}

function toBeijingInput(iso: string): string {
  const beijingDate = new Date(new Date(iso).getTime() + 8 * 60 * 60 * 1000)
  beijingDate.setUTCMinutes(Math.round(beijingDate.getUTCMinutes() / 5) * 5, 0, 0)
  return beijingDate.toISOString().slice(0, 16)
}

function formatBeijingDateTime(iso: string): string {
  return new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(iso))
}

function formatMeetingCode(code: string): string {
  const digits = code.replace(/\D/g, '')
  if (digits.length === 9) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`
  }
  return code
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    const textarea = document.createElement('textarea')
    textarea.value = text
    textarea.style.position = 'fixed'
    textarea.style.opacity = '0'
    document.body.appendChild(textarea)
    textarea.select()
    const copied = document.execCommand('copy')
    textarea.remove()
    return copied
  }
}

export default function TencentMeetingClient({
  viewerName,
  serverNow,
  defaultStartTime,
  defaultEndTime,
  initialBookings,
}: {
  viewerName: string
  serverNow: string
  defaultStartTime: string
  defaultEndTime: string
  initialBookings: Booking[]
}) {
  const router = useRouter()
  const [now, setNow] = useState(new Date(serverNow).getTime())
  const [activeTab, setActiveTab] = useState<BookingViewStatus>('UPCOMING')
  const [form, setForm] = useState<TencentMeetingInput>({
    subject: '',
    startTime: defaultStartTime,
    endTime: defaultEndTime,
    password: '',
  })
  const [editing, setEditing] = useState<Booking | null>(null)
  const [editForm, setEditForm] = useState<TencentMeetingInput | null>(null)
  const [busyAction, setBusyAction] = useState<string | null>(null)
  const [recordingPasswords, setRecordingPasswords] = useState<Record<string, string>>({})
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60_000)
    return () => window.clearInterval(timer)
  }, [])

  const grouped = useMemo(() => {
    const groups: Record<BookingViewStatus, Booking[]> = {
      UPCOMING: [],
      ONGOING: [],
      ENDED: [],
      CANCELLED: [],
    }
    initialBookings.forEach((booking) => groups[getStatus(booking, now)].push(booking))
    groups.UPCOMING.sort((a, b) => +new Date(a.startTime) - +new Date(b.startTime))
    groups.ONGOING.sort((a, b) => +new Date(a.endTime) - +new Date(b.endTime))
    return groups
  }, [initialBookings, now])

  const runAction = async (key: string, action: () => Promise<{ success: boolean; error?: string; message?: string }>) => {
    setBusyAction(key)
    setMessage(null)
    try {
      const result = await action()
      if (!result.success) {
        setMessage({ type: 'error', text: result.error || '操作失败，请稍后重试' })
        return false
      }
      setMessage({ type: 'success', text: result.message || '操作成功' })
      router.refresh()
      return true
    } catch {
      setMessage({ type: 'error', text: '网络异常，请稍后重试' })
      return false
    } finally {
      setBusyAction(null)
    }
  }

  const handleCreate = async (event: FormEvent) => {
    event.preventDefault()
    const success = await runAction('create', () => createTencentMeeting(form))
    if (success) setForm((current) => ({ ...current, subject: '', password: '' }))
  }

  const openEdit = (booking: Booking) => {
    setEditing(booking)
    setEditForm({
      subject: booking.subject,
      startTime: toBeijingInput(booking.startTime),
      endTime: toBeijingInput(booking.endTime),
      password: booking.meetingPassword ?? '',
    })
  }

  const handleEdit = async (event: FormEvent) => {
    event.preventDefault()
    if (!editing || !editForm) return
    if (!window.confirm(`确认修改「${editing.subject}」的会议信息吗？`)) return
    const success = await runAction(`edit-${editing.id}`, () => updateTencentMeeting(editing.id, editForm))
    if (success) {
      setEditing(null)
      setEditForm(null)
    }
  }

  const handleCancel = async (booking: Booking) => {
    if (!window.confirm(`确认取消「${booking.subject}」吗？取消后无法恢复。`)) return
    await runAction(`cancel-${booking.id}`, () => cancelTencentMeeting(booking.id))
  }

  const handleCopy = async (text: string, successText: string) => {
    const copied = await copyText(text)
    setMessage({
      type: copied ? 'success' : 'error',
      text: copied ? successText : '复制失败，请手动选择文本复制',
    })
  }

  const meetings = grouped[activeTab]

  return (
    <div className="space-y-7">
      <section className="card border-2 border-indigo-100">
        <div className="mb-5">
          <h2 className="text-lg font-semibold text-gray-900">预约新会议</h2>
          <p className="mt-1 text-sm text-gray-500">北京时间（UTC+8），默认开启云录制；共享账号同一时间只能安排一场会议。</p>
        </div>
        <form onSubmit={handleCreate} className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <label className="md:col-span-2 text-sm font-medium text-gray-700">
            会议主题
            <input
              className="input mt-1"
              value={form.subject}
              maxLength={100}
              required
              placeholder={`${viewerName}的会议`}
              onChange={(event) => setForm({ ...form, subject: event.target.value })}
            />
          </label>
          <ChineseDateTimePicker label="开始时间" value={form.startTime} onChange={(value) => setForm({ ...form, startTime: value })} />
          <ChineseDateTimePicker label="结束时间" value={form.endTime} onChange={(value) => setForm({ ...form, endTime: value })} />
          <label className="text-sm font-medium text-gray-700">
            会议密码（可选）
            <input
              className="input mt-1"
              value={form.password}
              inputMode="numeric"
              maxLength={6}
              placeholder="4～6位数字"
              onChange={(event) => setForm({ ...form, password: event.target.value })}
            />
          </label>
          <div className="flex items-end">
            <button type="submit" className="btn-primary w-full" disabled={busyAction === 'create'}>
              {busyAction === 'create' ? '预约中…' : '预约会议'}
            </button>
          </div>
        </form>
      </section>

      {message && (
        <div className={`rounded-xl border p-4 text-sm ${message.type === 'success' ? 'border-green-200 bg-green-50 text-green-800' : 'border-red-200 bg-red-50 text-red-800'}`}>
          {message.text}
        </div>
      )}

      <section>
        <div className="mb-5 flex flex-wrap gap-2">
          {(Object.keys(TAB_LABELS) as BookingViewStatus[]).map((status) => (
            <button
              key={status}
              type="button"
              onClick={() => setActiveTab(status)}
              className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${activeTab === status ? 'bg-indigo-600 text-white' : 'bg-white text-gray-600 border border-gray-200 hover:border-indigo-300'}`}
            >
              {TAB_LABELS[status]}（{grouped[status].length}）
            </button>
          ))}
        </div>

        {meetings.length === 0 ? (
          <div className="card py-12 text-center text-gray-500">暂无{TAB_LABELS[activeTab]}的会议</div>
        ) : (
          <div className="space-y-4">
            {meetings.map((booking) => {
              const status = getStatus(booking, now)
              return (
                <article key={booking.id} className="card border-l-4 border-l-indigo-400">
                  <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                    <div className="min-w-0">
                      <h3 className="text-lg font-semibold text-gray-900 break-words">{booking.subject}</h3>
                      <p className="mt-1 text-sm text-gray-600">
                        {formatBeijingDateTime(booking.startTime)} — {formatBeijingDateTime(booking.endTime)}
                      </p>
                      <p className="mt-1 text-sm text-gray-500">预约人：{booking.creatorName}</p>
                      <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm text-gray-600">
                        <span>#腾讯会议：<strong className="font-mono text-gray-900">{formatMeetingCode(booking.meetingCode)}</strong></span>
                        <span>会议密码：<strong className="font-mono text-gray-900">{booking.meetingPassword || '未设置'}</strong></span>
                      </div>
                    </div>
                    {status !== 'CANCELLED' && status !== 'ENDED' && (
                      <a href={booking.joinUrl} target="_blank" rel="noreferrer" className="btn-primary whitespace-nowrap">加入会议</a>
                    )}
                  </div>

                  {status !== 'CANCELLED' && status !== 'ENDED' && (
                    <div className="mt-4 rounded-xl bg-indigo-50 p-4 text-sm text-indigo-900">
                      会议由共享账号预约。如需云录制，请由共享账号进入会议并在腾讯会议中开启录制。
                    </div>
                  )}

                  {status === 'ENDED' && (
                    <div className="mt-4 rounded-xl border border-gray-200 bg-gray-50 p-4">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="text-sm">
                          <p className="font-medium text-gray-900">云录制</p>
                          {!booking.recordingUrl && <p className="mt-1 text-gray-500">录制可能仍在处理中，可手动刷新检查。</p>}
                          {booking.recordingUrl && !booking.recordingPassword && <p className="mt-1 text-amber-700">录制链接已生成，请补录访问密码。</p>}
                          {booking.recordingUrl && booking.recordingPassword && <p className="mt-1 text-green-700">录制链接和访问密码已准备好。</p>}
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <button type="button" className="btn-secondary" disabled={busyAction === `record-${booking.id}`} onClick={() => runAction(`record-${booking.id}`, () => syncTencentMeetingRecording(booking.id))}>
                            {busyAction === `record-${booking.id}` ? '同步中…' : booking.recordingUrl ? '刷新录制' : '同步录制'}
                          </button>
                          {booking.recordingUrl && booking.recordingPassword && (
                            <button type="button" className="btn-primary" onClick={() => handleCopy(`${booking.recordingUrl}\n访问密码：${booking.recordingPassword}`, '录制链接和密码已复制')}>
                              复制录制信息
                            </button>
                          )}
                        </div>
                      </div>
                      {booking.recordingUrl && (
                        <div className="mt-4 flex flex-col gap-2 border-t border-gray-200 pt-4 sm:flex-row sm:items-end">
                          <label className="text-sm font-medium text-gray-700">
                            录制访问密码
                            <input
                              className="input mt-1 w-48 font-mono"
                              value={recordingPasswords[booking.id] ?? booking.recordingPassword ?? ''}
                              maxLength={8}
                              placeholder="4～8位字母或数字"
                              onChange={(event) => setRecordingPasswords((current) => ({
                                ...current,
                                [booking.id]: event.target.value,
                              }))}
                            />
                          </label>
                          <button
                            type="button"
                            className="btn-secondary"
                            disabled={busyAction === `password-${booking.id}`}
                            onClick={() => runAction(
                              `password-${booking.id}`,
                              () => setTencentMeetingRecordingPassword(
                                booking.id,
                                recordingPasswords[booking.id] ?? booking.recordingPassword ?? ''
                              )
                            )}
                          >
                            {busyAction === `password-${booking.id}` ? '保存中…' : '保存密码'}
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="mt-4 flex flex-wrap gap-4 border-t border-gray-100 pt-4 text-sm">
                    <button type="button" className="font-medium text-indigo-600 hover:text-indigo-800" onClick={() => handleCopy(`${booking.subject}\n时间：${formatBeijingDateTime(booking.startTime)}\n#腾讯会议：${formatMeetingCode(booking.meetingCode)}${booking.meetingPassword ? `\n会议密码：${booking.meetingPassword}` : ''}\n${booking.joinUrl}`, '会议信息已复制')}>
                      复制会议信息
                    </button>
                    {status === 'UPCOMING' && (
                      <>
                        <button type="button" className="font-medium text-gray-600 hover:text-gray-900" onClick={() => openEdit(booking)}>修改会议</button>
                        <button type="button" className="font-medium text-red-600 hover:text-red-800" disabled={busyAction === `cancel-${booking.id}`} onClick={() => handleCancel(booking)}>
                          {busyAction === `cancel-${booking.id}` ? '取消中…' : '取消会议'}
                        </button>
                      </>
                    )}
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </section>

      {editing && editForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <form onSubmit={handleEdit} className="w-full max-w-lg rounded-2xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
              <h2 className="text-lg font-semibold">修改会议</h2>
              <button type="button" className="text-2xl text-gray-400" onClick={() => setEditing(null)}>×</button>
            </div>
            <div className="space-y-4 p-6">
              <label className="block text-sm font-medium text-gray-700">会议主题<input className="input mt-1" value={editForm.subject} required onChange={(e) => setEditForm({ ...editForm, subject: e.target.value })} /></label>
              <ChineseDateTimePicker label="开始时间" value={editForm.startTime} onChange={(value) => setEditForm({ ...editForm, startTime: value })} />
              <ChineseDateTimePicker label="结束时间" value={editForm.endTime} onChange={(value) => setEditForm({ ...editForm, endTime: value })} />
              <label className="block text-sm font-medium text-gray-700">会议密码（留空则取消密码）<input className="input mt-1" value={editForm.password} inputMode="numeric" maxLength={6} onChange={(e) => setEditForm({ ...editForm, password: e.target.value })} /></label>
            </div>
            <div className="flex justify-end gap-3 border-t border-gray-200 px-6 py-4">
              <button type="button" className="btn-secondary" onClick={() => setEditing(null)}>返回</button>
              <button type="submit" className="btn-primary" disabled={busyAction === `edit-${editing.id}`}>{busyAction === `edit-${editing.id}` ? '保存中…' : '确认修改'}</button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
