-- AlterEnum: 实习证明状态新增 REJECTED（已打回）
ALTER TYPE "InternshipCertificateDraftStatus" ADD VALUE 'REJECTED';

-- CreateEnum: 实习证明模板来源
CREATE TYPE "InternshipCertificateTemplateMode" AS ENUM ('SYSTEM', 'CUSTOM');

-- AlterTable: 自定义模板下表单字段可为空
ALTER TABLE "internship_certificate_drafts" ALTER COLUMN "name" DROP NOT NULL;
ALTER TABLE "internship_certificate_drafts" ALTER COLUMN "gender" DROP NOT NULL;
ALTER TABLE "internship_certificate_drafts" ALTER COLUMN "idCard" DROP NOT NULL;
ALTER TABLE "internship_certificate_drafts" ALTER COLUMN "startDate" DROP NOT NULL;
ALTER TABLE "internship_certificate_drafts" ALTER COLUMN "endDate" DROP NOT NULL;

-- AlterTable: 新增模板来源与打回字段
ALTER TABLE "internship_certificate_drafts" ADD COLUMN "templateMode" "InternshipCertificateTemplateMode" NOT NULL DEFAULT 'SYSTEM';
ALTER TABLE "internship_certificate_drafts" ADD COLUMN "rejectionReason" TEXT;
ALTER TABLE "internship_certificate_drafts" ADD COLUMN "rejectedAt" TIMESTAMP(3);
