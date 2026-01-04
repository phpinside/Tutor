-- Drop referralViewCode field and related index/constraint
-- This removes the old viewCode-based access method

-- Drop the unique constraint
ALTER TABLE "teachers" DROP CONSTRAINT IF EXISTS "teachers_referralViewCode_key";

-- Drop the column
ALTER TABLE "teachers" DROP COLUMN IF EXISTS "referralViewCode";
