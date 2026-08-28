import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import TencentMeetingClient from '@/app/onboarding/tools/tencent-meeting/TencentMeetingClient'

export const dynamic = 'force-dynamic'

function toBeijingLocalInput(date: Date): string {
  return new Date(date.getTime() + 8 * 60 * 60 * 1000).toISOString().slice(0, 16)
}

export default async function TencentMeetingsAdminPage() {
  const cookieStore = await cookies()
  let viewerName: string | null = null

  const operatorSession = cookieStore.get('operator_session')?.value
  if (operatorSession) {
    try {
      const data = JSON.parse(operatorSession) as { operatorId?: string }
      if (data.operatorId) {
        const operator = await prisma.operator.findFirst({
          where: { id: data.operatorId, isEnabled: true },
          select: { name: true },
        })
        viewerName = operator?.name ?? null
      }
    } catch {}
  }

  if (!viewerName) {
    const adminSession = cookieStore.get('admin_session')?.value
    if (adminSession) {
      try {
        const data = JSON.parse(adminSession) as { authenticated?: boolean; role?: string }
        if (data.authenticated && data.role === 'super_admin') viewerName = '超级管理员'
      } catch {}
    }
  }
  if (!viewerName) redirect('/admin/login')

  const bookings = await prisma.tencentMeetingBooking.findMany({
    orderBy: { startTime: 'desc' },
    take: 200,
  })

  const now = new Date()
  const start = new Date(now)
  start.setMinutes(0, 0, 0)
  start.setHours(start.getHours() + 1)
  const end = new Date(start.getTime() + 60 * 60 * 1000)

  return (
    <div>
      <div className="mb-8">
        <div className="mb-2 flex items-center gap-3">
          <span className="text-3xl">📹</span>
          <h1 className="text-3xl font-bold text-gray-900">腾讯会议预约</h1>
        </div>
        <p className="text-gray-600">运营人员和管理员共享查看、预约和管理所有会议。</p>
      </div>

      <TencentMeetingClient
        viewerName={viewerName}
        serverNow={now.toISOString()}
        defaultStartTime={toBeijingLocalInput(start)}
        defaultEndTime={toBeijingLocalInput(end)}
        initialBookings={bookings.map((booking) => ({
          id: booking.id,
          creatorType: booking.creatorType,
          creatorName: booking.creatorName,
          meetingCode: booking.meetingCode,
          subject: booking.subject,
          startTime: booking.startTime.toISOString(),
          endTime: booking.endTime.toISOString(),
          joinUrl: booking.joinUrl,
          meetingPassword: booking.meetingPassword,
          status: booking.status,
          recordingUrl: booking.recordingUrl,
          recordingPassword: booking.recordingPassword,
          recordingSyncedAt: booking.recordingSyncedAt?.toISOString() ?? null,
        }))}
      />
    </div>
  )
}
