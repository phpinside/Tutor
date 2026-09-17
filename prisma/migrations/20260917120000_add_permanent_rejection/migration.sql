-- 新增审核阶段枚举值：永久拒绝入驻（终态）
ALTER TYPE "CoachReviewStage" ADD VALUE IF NOT EXISTS 'PERMANENTLY_REJECTED';

-- Teacher 表新增永久拒绝入驻标记
ALTER TABLE "teachers" ADD COLUMN IF NOT EXISTS "permanentlyRejectedAt" TIMESTAMP(3);
ALTER TABLE "teachers" ADD COLUMN IF NOT EXISTS "permanentlyRejectedBy" TEXT;
