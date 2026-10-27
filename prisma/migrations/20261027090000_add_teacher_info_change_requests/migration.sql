-- 教练资料修改申请：姓名/高考省份/高考成绩；教练提交 → 学管初审 → 运营复审 → 生效
CREATE TYPE "TeacherInfoChangeRequestStatus" AS ENUM ('PENDING_FIRST_REVIEW', 'PENDING_FINAL_REVIEW', 'APPROVED', 'REJECTED', 'CANCELLED');

CREATE TABLE "teacher_info_change_requests" (
    "id" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "status" "TeacherInfoChangeRequestStatus" NOT NULL DEFAULT 'PENDING_FIRST_REVIEW',
    "changes" JSONB NOT NULL,
    "proofImages" JSONB NOT NULL,
    "reason" TEXT,
    "firstReviewerId" TEXT,
    "firstReviewerName" TEXT,
    "firstReviewerRole" TEXT,
    "firstReviewedAt" TIMESTAMP(3),
    "firstReviewNote" TEXT,
    "finalReviewerId" TEXT,
    "finalReviewerName" TEXT,
    "finalReviewerRole" TEXT,
    "finalReviewedAt" TIMESTAMP(3),
    "finalReviewNote" TEXT,
    "appliedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "teacher_info_change_requests_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "teacher_info_change_requests_status_createdAt_idx" ON "teacher_info_change_requests"("status", "createdAt");
CREATE INDEX "teacher_info_change_requests_teacherId_idx" ON "teacher_info_change_requests"("teacherId");

ALTER TABLE "teacher_info_change_requests" ADD CONSTRAINT "teacher_info_change_requests_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "teachers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
