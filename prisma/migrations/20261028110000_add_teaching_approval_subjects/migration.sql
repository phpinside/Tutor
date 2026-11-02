-- 特批授课能力增加科目维度（数学/物理/化学）
ALTER TABLE "teacher_teaching_approvals" ADD COLUMN "subjects" TEXT NOT NULL DEFAULT '';
