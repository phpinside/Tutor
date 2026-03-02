-- AlterTable
-- Change mathScore column type from TEXT to INTEGER with explicit cast
ALTER TABLE "teachers"
  ALTER COLUMN "mathScore" TYPE INTEGER
  USING ("mathScore"::INTEGER);
