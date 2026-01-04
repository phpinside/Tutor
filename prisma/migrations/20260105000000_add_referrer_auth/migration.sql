-- AlterTable: Add password field and make phone unique
ALTER TABLE "teachers" ADD COLUMN IF NOT EXISTS "password" TEXT;

-- Add unique constraint to phone field (only if not already exists)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'teachers_phone_key'
  ) THEN
    ALTER TABLE "teachers" ADD CONSTRAINT "teachers_phone_key" UNIQUE ("phone");
  END IF;
END $$;


ALTER TABLE "teachers" ADD COLUMN IF NOT EXISTS "password" TEXT;

-- CreateIndex: Add indexes for better query performance
CREATE INDEX IF NOT EXISTS "teachers_phone_idx" ON "teachers"("phone");
CREATE INDEX IF NOT EXISTS "teachers_currentTaskIndex_idx" ON "teachers"("currentTaskIndex");
CREATE INDEX IF NOT EXISTS "teachers_createdAt_idx" ON "teachers"("createdAt");
