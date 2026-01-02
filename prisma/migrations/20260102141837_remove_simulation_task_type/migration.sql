-- Remove SIMULATION from TaskType enum
-- This is safe because no tasks are using the SIMULATION type

-- Step 1: Create a new enum without SIMULATION
CREATE TYPE "TaskType_new" AS ENUM ('INFO', 'FORM', 'VIDEO_UPLOAD', 'TRAINING', 'PRACTICE');

-- Step 2: Update the task_submissions table to use the new enum
ALTER TABLE "task_submissions" ALTER COLUMN "taskType" TYPE "TaskType_new" USING ("taskType"::text::"TaskType_new");

-- Step 3: Update the task_configs table to use the new enum
ALTER TABLE "task_configs" ALTER COLUMN "type" TYPE "TaskType_new" USING ("type"::text::"TaskType_new");

-- Step 4: Drop the old enum
DROP TYPE "TaskType";

-- Step 5: Rename the new enum to the original name
ALTER TYPE "TaskType_new" RENAME TO "TaskType";
