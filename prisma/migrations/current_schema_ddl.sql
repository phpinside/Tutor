-- CreateEnum
CREATE TYPE "TeacherStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'PENDING_REVIEW', 'COMPLETED', 'UNLOCKED');

-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'PENDING_FEEDBACK', 'COMPLETED', 'NEEDS_REVISION');

-- CreateEnum
CREATE TYPE "TaskType" AS ENUM ('INFO', 'FORM', 'VIDEO_UPLOAD', 'TRAINING', 'PRACTICE');

-- CreateEnum
CREATE TYPE "ReferralStatus" AS ENUM ('PENDING', 'VALID', 'INVALID');

-- CreateEnum
CREATE TYPE "ReferralType" AS ENUM ('DIRECT', 'INDIRECT');

-- CreateEnum
CREATE TYPE "WithdrawalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "teachers" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "phone" TEXT,
    "password" TEXT,
    "gender" TEXT,
    "age" TEXT,
    "school" TEXT,
    "graduationYear" TEXT,
    "identity" TEXT,
    "mathScore" TEXT,
    "mathCompetition" TEXT,
    "teachingExperience" TEXT,
    "gradePreference" TEXT,
    "teachingStrengths" TEXT,
    "teachingStyle" TEXT,
    "studentTypes" TEXT,
    "weekdayTime" TEXT,
    "weekendTime" TEXT,
    "holidayTime" TEXT,
    "status" "TeacherStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "currentPhase" INTEGER NOT NULL DEFAULT 1,
    "currentTaskIndex" INTEGER NOT NULL DEFAULT 0,
    "inviteCode" TEXT,
    "invitedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "teachers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_submissions" (
    "id" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "taskIndex" INTEGER NOT NULL,
    "taskType" "TaskType" NOT NULL,
    "status" "TaskStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "formData" JSONB,
    "textContent" TEXT,
    "watchProgress" INTEGER DEFAULT 0,
    "feedback" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewedBy" TEXT,
    "attemptCount" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "task_submissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_configs" (
    "id" TEXT NOT NULL,
    "index" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "phase" INTEGER NOT NULL,
    "emoji" TEXT NOT NULL,
    "type" "TaskType" NOT NULL,
    "description" TEXT NOT NULL,
    "estimatedMinutes" INTEGER NOT NULL,
    "isOptional" BOOLEAN NOT NULL DEFAULT false,
    "requirements" JSONB NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "task_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "phase_configs" (
    "id" TEXT NOT NULL,
    "phase" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "phase_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "referrals" (
    "id" TEXT NOT NULL,
    "referrerId" TEXT NOT NULL,
    "referredId" TEXT NOT NULL,
    "type" "ReferralType" NOT NULL DEFAULT 'DIRECT',
    "indirectReferrerId" TEXT,
    "status" "ReferralStatus" NOT NULL DEFAULT 'PENDING',
    "rewardSent" BOOLEAN NOT NULL DEFAULT false,
    "adminNote" TEXT,
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "referrals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "withdrawals" (
    "id" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "accountName" TEXT NOT NULL,
    "bankName" TEXT NOT NULL,
    "cardNumber" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "idCard" TEXT NOT NULL,
    "status" "WithdrawalStatus" NOT NULL DEFAULT 'PENDING',
    "rejectNote" TEXT,
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "withdrawals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "system_configs" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "system_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "referral_stats" (
    "id" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "directTotal" INTEGER NOT NULL DEFAULT 0,
    "directValid" INTEGER NOT NULL DEFAULT 0,
    "directPending" INTEGER NOT NULL DEFAULT 0,
    "directInvalid" INTEGER NOT NULL DEFAULT 0,
    "indirectTotal" INTEGER NOT NULL DEFAULT 0,
    "indirectValid" INTEGER NOT NULL DEFAULT 0,
    "indirectPending" INTEGER NOT NULL DEFAULT 0,
    "indirectInvalid" INTEGER NOT NULL DEFAULT 0,
    "totalEarnings" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalWithdrawn" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "pendingWithdrawal" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "availableBalance" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "lastUpdated" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "referral_stats_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "teachers_phone_key" ON "teachers"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "teachers_inviteCode_key" ON "teachers"("inviteCode");

-- CreateIndex
CREATE INDEX "teachers_phone_idx" ON "teachers"("phone");

-- CreateIndex
CREATE INDEX "teachers_currentTaskIndex_idx" ON "teachers"("currentTaskIndex");

-- CreateIndex
CREATE INDEX "teachers_createdAt_idx" ON "teachers"("createdAt");

-- CreateIndex
CREATE INDEX "task_submissions_teacherId_idx" ON "task_submissions"("teacherId");

-- CreateIndex
CREATE INDEX "task_submissions_status_idx" ON "task_submissions"("status");

-- CreateIndex
CREATE UNIQUE INDEX "task_submissions_teacherId_taskIndex_key" ON "task_submissions"("teacherId", "taskIndex");

-- CreateIndex
CREATE UNIQUE INDEX "task_configs_index_key" ON "task_configs"("index");

-- CreateIndex
CREATE UNIQUE INDEX "phase_configs_phase_key" ON "phase_configs"("phase");

-- CreateIndex
CREATE INDEX "referrals_referrerId_idx" ON "referrals"("referrerId");

-- CreateIndex
CREATE INDEX "referrals_referredId_idx" ON "referrals"("referredId");

-- CreateIndex
CREATE INDEX "referrals_status_idx" ON "referrals"("status");

-- CreateIndex
CREATE INDEX "referrals_type_idx" ON "referrals"("type");

-- CreateIndex
CREATE INDEX "referrals_indirectReferrerId_idx" ON "referrals"("indirectReferrerId");

-- CreateIndex
CREATE UNIQUE INDEX "referrals_referrerId_referredId_type_key" ON "referrals"("referrerId", "referredId", "type");

-- CreateIndex
CREATE INDEX "withdrawals_teacherId_idx" ON "withdrawals"("teacherId");

-- CreateIndex
CREATE INDEX "withdrawals_status_idx" ON "withdrawals"("status");

-- CreateIndex
CREATE INDEX "withdrawals_createdAt_idx" ON "withdrawals"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "system_configs_key_key" ON "system_configs"("key");

-- CreateIndex
CREATE UNIQUE INDEX "referral_stats_teacherId_key" ON "referral_stats"("teacherId");

-- CreateIndex
CREATE INDEX "referral_stats_teacherId_idx" ON "referral_stats"("teacherId");

-- AddForeignKey
ALTER TABLE "teachers" ADD CONSTRAINT "teachers_invitedById_fkey" FOREIGN KEY ("invitedById") REFERENCES "teachers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_submissions" ADD CONSTRAINT "task_submissions_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "teachers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "referrals" ADD CONSTRAINT "referrals_referrerId_fkey" FOREIGN KEY ("referrerId") REFERENCES "teachers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "referrals" ADD CONSTRAINT "referrals_referredId_fkey" FOREIGN KEY ("referredId") REFERENCES "teachers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "withdrawals" ADD CONSTRAINT "withdrawals_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "teachers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "referral_stats" ADD CONSTRAINT "referral_stats_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "teachers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

