-- 奖状模板列表缩略图路径（为空时前端回退加载底图原图）
ALTER TABLE "student_certificate_templates" ADD COLUMN "thumbnailPath" TEXT;

-- 内置模板缩略图与底图同目录、以 -thumb 后缀命名，由 prisma/generateTemplateThumbnails.ts 生成；
-- 管理员上传的底图（upload- 前缀）在创建/更新模板时由服务端生成缩略图后写入。
UPDATE "student_certificate_templates"
SET "thumbnailPath" = regexp_replace("backgroundPath", '\.(png|jpe?g|webp)$', '-thumb.jpg')
WHERE "backgroundPath" IS NOT NULL
  AND "backgroundPath" LIKE '/student-certificate-templates/%'
  AND "backgroundPath" NOT LIKE '/student-certificate-templates/upload-%';
