-- AlterTable
-- 添加新字段
ALTER TABLE "teachers" ADD COLUMN "phone" TEXT;
ALTER TABLE "teachers" ADD COLUMN "gender" TEXT;
ALTER TABLE "teachers" ADD COLUMN "age" TEXT;
ALTER TABLE "teachers" ADD COLUMN "graduationYear" TEXT;
ALTER TABLE "teachers" ADD COLUMN "identity" TEXT;
ALTER TABLE "teachers" ADD COLUMN "mathScore" TEXT;
ALTER TABLE "teachers" ADD COLUMN "mathCompetition" TEXT;
ALTER TABLE "teachers" ADD COLUMN "teachingExperience" TEXT;
ALTER TABLE "teachers" ADD COLUMN "teachingStrengths" TEXT;
ALTER TABLE "teachers" ADD COLUMN "teachingStyle" TEXT;
ALTER TABLE "teachers" ADD COLUMN "studentTypes" TEXT;
ALTER TABLE "teachers" ADD COLUMN "weekdayTime" TEXT;
ALTER TABLE "teachers" ADD COLUMN "weekendTime" TEXT;
ALTER TABLE "teachers" ADD COLUMN "holidayTime" TEXT;

-- 删除旧字段（保留数据迁移）
-- 将 major 的数据迁移到 school（如果需要保留）
UPDATE "teachers" SET "school" = CONCAT(COALESCE("school", ''), ' ', COALESCE("major", '')) WHERE "major" IS NOT NULL;

-- 将 availableTime 的数据迁移到 weekdayTime（如果需要保留）
UPDATE "teachers" SET "weekdayTime" = "availableTime" WHERE "availableTime" IS NOT NULL;

-- 删除旧字段
ALTER TABLE "teachers" DROP COLUMN "major";
ALTER TABLE "teachers" DROP COLUMN "availableTime";


