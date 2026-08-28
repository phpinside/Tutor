-- CreateEnum
CREATE TYPE "TencentMeetingCreatorType" AS ENUM ('TEACHER', 'OPERATOR', 'ADMIN');

-- AlterTable
ALTER TABLE "tencent_meeting_bookings"
ADD COLUMN "creatorType" "TencentMeetingCreatorType" NOT NULL DEFAULT 'ADMIN',
ADD COLUMN "creatorId" TEXT,
ADD COLUMN "creatorName" TEXT NOT NULL DEFAULT '管理员',
ALTER COLUMN "teacherId" DROP NOT NULL;

-- Preserve the creator information of bookings made before staff-only access.
UPDATE "tencent_meeting_bookings" AS booking
SET
  "creatorType" = 'TEACHER',
  "creatorId" = booking."teacherId",
  "creatorName" = teacher."name"
FROM "teachers" AS teacher
WHERE booking."teacherId" = teacher."id";

-- Change the legacy teacher relation to optional so deleting a teacher does not
-- delete a meeting record from the shared staff list.
ALTER TABLE "tencent_meeting_bookings"
DROP CONSTRAINT "tencent_meeting_bookings_teacherId_fkey";

ALTER TABLE "tencent_meeting_bookings"
ADD CONSTRAINT "tencent_meeting_bookings_teacherId_fkey"
FOREIGN KEY ("teacherId") REFERENCES "teachers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "tencent_meeting_bookings_creatorType_creatorId_idx"
ON "tencent_meeting_bookings"("creatorType", "creatorId");
