-- 落款日期（证明开具时间）模板可配置：
-- 1) 模板新增落款日期取值方式 dateMode（默认 END_DATE = 表单结束日期，保持既有输出不变）
--    以及固定日期 fixedDate（仅 dateMode = FIXED 时使用，YYYY-MM-DD）
-- 2) 草稿新增模板配置快照 templateSnapshot，开具时按快照重新渲染，避免开具前改模板导致串版

ALTER TABLE "certificate_templates" ADD COLUMN "dateMode" TEXT NOT NULL DEFAULT 'END_DATE';
ALTER TABLE "certificate_templates" ADD COLUMN "fixedDate" TEXT;

ALTER TABLE "certificate_drafts" ADD COLUMN "templateSnapshot" JSONB;
