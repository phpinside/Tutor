-- 证明开具统一化：
-- 1) 新增证明类型枚举与可配置模板表 certificate_templates
-- 2) internship_certificate_drafts 重命名为 certificate_drafts，新增 certificateType / templateId / extraData
-- 3) 原有枚举类型重命名为与统一模型匹配的名称

ALTER TYPE "InternshipCertificateDraftStatus" RENAME TO "CertificateDraftStatus";
ALTER TYPE "InternshipCertificateTemplateMode" RENAME TO "CertificateTemplateMode";

CREATE TYPE "CertificateType" AS ENUM ('INTERNSHIP', 'LABOR_CONFIRMATION');

-- 证明模板表（正文支持 {{字段}} 占位符，fields 为表单字段定义 JSON）
CREATE TABLE "certificate_templates" (
    "id" TEXT NOT NULL,
    "type" "CertificateType" NOT NULL,
    "name" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "companyName" TEXT NOT NULL DEFAULT '北京一生二科技有限公司',
    "bodyText" TEXT NOT NULL,
    "fields" JSONB NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "certificate_templates_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "certificate_templates_type_name_key" ON "certificate_templates"("type", "name");
CREATE INDEX "certificate_templates_type_isActive_idx" ON "certificate_templates"("type", "isActive");

ALTER TABLE "internship_certificate_drafts" RENAME TO "certificate_drafts";

ALTER TABLE "certificate_drafts" ADD COLUMN "certificateType" "CertificateType" NOT NULL DEFAULT 'INTERNSHIP';
ALTER TABLE "certificate_drafts" ADD COLUMN "templateId" TEXT;
ALTER TABLE "certificate_drafts" ADD COLUMN "extraData" JSONB;

CREATE INDEX "certificate_drafts_certificateType_idx" ON "certificate_drafts"("certificateType");

ALTER TABLE "certificate_drafts" ADD CONSTRAINT "certificate_drafts_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "certificate_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- 同步索引命名（RENAME TABLE 不会自动重命名索引）
ALTER INDEX "internship_certificate_drafts_teacherId_idx" RENAME TO "certificate_drafts_teacherId_idx";
ALTER INDEX "internship_certificate_drafts_status_idx" RENAME TO "certificate_drafts_status_idx";
ALTER INDEX "internship_certificate_drafts_createdAt_idx" RENAME TO "certificate_drafts_createdAt_idx";
