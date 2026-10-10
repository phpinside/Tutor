CREATE TABLE IF NOT EXISTS "student_certificate_records" (
    "id" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "templateName" TEXT NOT NULL,
    "studentName" TEXT NOT NULL,
    "grade" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "awardName" TEXT NOT NULL,
    "citation" TEXT NOT NULL,
    "issuer" TEXT NOT NULL,
    "issueDate" TEXT NOT NULL,
    "teamName" TEXT NOT NULL,
    "coachName" TEXT NOT NULL,
    "imageKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "student_certificate_records_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "student_certificate_records_teacherId_createdAt_idx" ON "student_certificate_records"("teacherId", "createdAt");
CREATE INDEX IF NOT EXISTS "student_certificate_records_createdAt_idx" ON "student_certificate_records"("createdAt");
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'student_certificate_records_teacherId_fkey') THEN
    ALTER TABLE "student_certificate_records" ADD CONSTRAINT "student_certificate_records_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "teachers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
