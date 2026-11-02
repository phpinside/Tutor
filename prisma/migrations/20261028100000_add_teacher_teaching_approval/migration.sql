-- 运营特批授课能力（教练可派单资格审查用；教练不可见，学管只读，运营/超管可设置）
CREATE TABLE "teacher_teaching_approvals" (
    "id" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "levels" TEXT NOT NULL,
    "updatedById" TEXT,
    "updatedByName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "teacher_teaching_approvals_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "teacher_teaching_approvals_teacherId_key" ON "teacher_teaching_approvals"("teacherId");

ALTER TABLE "teacher_teaching_approvals" ADD CONSTRAINT "teacher_teaching_approvals_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "teachers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
