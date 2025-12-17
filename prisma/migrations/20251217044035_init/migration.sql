-- CreateEnum
CREATE TYPE "TeacherStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'PENDING_REVIEW', 'COMPLETED', 'UNLOCKED');

-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'PENDING_FEEDBACK', 'COMPLETED', 'NEEDS_REVISION');

-- CreateEnum
CREATE TYPE "TaskType" AS ENUM ('INFO', 'FORM', 'VIDEO_UPLOAD', 'TRAINING', 'PRACTICE', 'SIMULATION');

-- CreateTable
CREATE TABLE "teachers" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "school" TEXT,
    "major" TEXT,
    "gradePreference" TEXT,
    "availableTime" TEXT,
    "status" "TeacherStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "currentPhase" INTEGER NOT NULL DEFAULT 1,
    "currentTaskIndex" INTEGER NOT NULL DEFAULT 0,
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
    "videoUrl" TEXT,
    "videoDuration" INTEGER,
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

-- AddForeignKey
ALTER TABLE "task_submissions" ADD CONSTRAINT "task_submissions_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "teachers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
