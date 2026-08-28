-- CreateEnum
CREATE TYPE "TencentMeetingBookingStatus" AS ENUM ('SCHEDULED', 'CANCELLED');

-- CreateTable
CREATE TABLE "tencent_meeting_bookings" (
    "id" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "meetingId" TEXT NOT NULL,
    "meetingCode" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "startTime" TIMESTAMP(3) NOT NULL,
    "endTime" TIMESTAMP(3) NOT NULL,
    "joinUrl" TEXT NOT NULL,
    "meetingPassword" TEXT,
    "status" "TencentMeetingBookingStatus" NOT NULL DEFAULT 'SCHEDULED',
    "meetingRecordId" TEXT,
    "recordingUrl" TEXT,
    "recordingPassword" TEXT,
    "recordingSyncedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tencent_meeting_bookings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tencent_meeting_bookings_meetingId_key" ON "tencent_meeting_bookings"("meetingId");

-- CreateIndex
CREATE INDEX "tencent_meeting_bookings_teacherId_startTime_idx" ON "tencent_meeting_bookings"("teacherId", "startTime");

-- CreateIndex
CREATE INDEX "tencent_meeting_bookings_status_endTime_idx" ON "tencent_meeting_bookings"("status", "endTime");

-- AddForeignKey
ALTER TABLE "tencent_meeting_bookings" ADD CONSTRAINT "tencent_meeting_bookings_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "teachers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
