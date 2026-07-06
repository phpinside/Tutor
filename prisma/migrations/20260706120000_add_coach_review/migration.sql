-- 新增枚举：教练审核阶段
CREATE TYPE "CoachReviewStage" AS ENUM ('FIRST_REVIEW', 'FINAL_REVIEW', 'APPROVED', 'REJECTED');

-- 新增枚举：审核结论
CREATE TYPE "ReviewVerdict" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'SKIPPED');

-- 新增表：教练两级审核记录
CREATE TABLE "coach_reviews" (
    "id"                   TEXT NOT NULL,
    "teacherId"            TEXT NOT NULL,
    "firstReviewOperatorId" TEXT,
    "firstReviewVerdict"   "ReviewVerdict" NOT NULL DEFAULT 'PENDING',
    "firstReviewedBy"      TEXT,
    "firstReviewedAt"      TIMESTAMP(3),
    "firstReviewNote"      TEXT,
    "finalReviewVerdict"   "ReviewVerdict" NOT NULL DEFAULT 'PENDING',
    "finalReviewedBy"      TEXT,
    "finalReviewedAt"      TIMESTAMP(3),
    "finalReviewNote"      TEXT,
    "stage"                "CoachReviewStage" NOT NULL DEFAULT 'FIRST_REVIEW',
    "attemptCount"         INTEGER NOT NULL DEFAULT 1,
    "resolvedManagerPhone" TEXT,
    "resolveSource"        TEXT,
    "createdAt"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"            TIMESTAMP(3) NOT NULL,

    CONSTRAINT "coach_reviews_pkey" PRIMARY KEY ("id")
);

-- 唯一约束：一个教练一条审核记录
CREATE UNIQUE INDEX "coach_reviews_teacherId_key" ON "coach_reviews"("teacherId");

-- 索引
CREATE INDEX "coach_reviews_stage_idx" ON "coach_reviews"("stage");
CREATE INDEX "coach_reviews_firstReviewOperatorId_idx" ON "coach_reviews"("firstReviewOperatorId");

-- 外键：关联 teachers 表，级联删除
ALTER TABLE "coach_reviews" ADD CONSTRAINT "coach_reviews_teacherId_fkey"
    FOREIGN KEY ("teacherId") REFERENCES "teachers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
