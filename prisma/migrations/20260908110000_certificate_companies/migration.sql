-- 单位与盖章图片可配置：
-- 1) 新增开具单位表 certificate_companies（落款名称 + 盖章图片七牛 key，空 = 系统默认公章）
-- 2) 模板新增可选单位列表（JSON id 数组）与默认单位
-- 3) 申请记录新增所选单位与盖章图片快照（不建外键，单位删除后历史申请仍可开具）

CREATE TABLE "certificate_companies" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "stampKey" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "certificate_companies_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "certificate_companies_name_key" ON "certificate_companies"("name");

ALTER TABLE "certificate_templates" ADD COLUMN "companyIds" JSONB;
ALTER TABLE "certificate_templates" ADD COLUMN "defaultCompanyId" TEXT;

ALTER TABLE "certificate_drafts" ADD COLUMN "companyId" TEXT;
ALTER TABLE "certificate_drafts" ADD COLUMN "stampKey" TEXT;
