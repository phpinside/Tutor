-- 教练资质证明 + 质疑取证 + 卷面总分 + 专项资质字段

-- 入驻审核阶段新增「质疑取证中」
ALTER TYPE "CoachReviewStage" ADD VALUE IF NOT EXISTS 'CHALLENGED' AFTER 'FINAL_REVIEW';

-- 资质证明类型 / 来源
CREATE TYPE "TeacherQualificationType" AS ENUM ('DEGREE_CERT', 'TEACHER_CERT', 'MANDARIN_CERT', 'GAOKAO_SCORE');
CREATE TYPE "TeacherQualificationSource" AS ENUM ('ONBOARDING', 'CHALLENGE');

-- Teacher：资质申报专项字段（供其它服务读取） + 卷面总分
ALTER TABLE "teachers" ADD COLUMN "hasTeacherCert" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "teachers" ADD COLUMN "teacherCertStage" TEXT;
ALTER TABLE "teachers" ADD COLUMN "teacherCertSubject" TEXT;
ALTER TABLE "teachers" ADD COLUMN "mandarinLevel" TEXT;
ALTER TABLE "teachers" ADD COLUMN "hasDegreeCert" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "teachers" ADD COLUMN "isInServiceTeacher" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "teachers" ADD COLUMN "mathScoreTotal" INTEGER;
ALTER TABLE "teachers" ADD COLUMN "physicsScoreTotal" INTEGER;
ALTER TABLE "teachers" ADD COLUMN "chemistryScoreTotal" INTEGER;

-- CoachReview：质疑取证
ALTER TABLE "coach_reviews" ADD COLUMN "challengeFromStage" TEXT;
ALTER TABLE "coach_reviews" ADD COLUMN "challengeItems" JSONB;
ALTER TABLE "coach_reviews" ADD COLUMN "challengeNote" TEXT;
ALTER TABLE "coach_reviews" ADD COLUMN "challengedById" TEXT;
ALTER TABLE "coach_reviews" ADD COLUMN "challengedByName" TEXT;
ALTER TABLE "coach_reviews" ADD COLUMN "challengedAt" TIMESTAMP(3);

-- 教练资质证明
CREATE TABLE "teacher_qualifications" (
    "id" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "type" "TeacherQualificationType" NOT NULL,
    "source" "TeacherQualificationSource" NOT NULL DEFAULT 'ONBOARDING',
    "files" JSONB NOT NULL,
    "meta" JSONB,
    "challengeRound" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "teacher_qualifications_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "teacher_qualifications_teacherId_type_idx" ON "teacher_qualifications"("teacherId", "type");

ALTER TABLE "teacher_qualifications" ADD CONSTRAINT "teacher_qualifications_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "teachers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
