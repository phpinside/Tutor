-- AlterTable: age TEXT -> INTEGER; empty or non-numeric -> NULL
ALTER TABLE "teachers"
  ALTER COLUMN "age" TYPE INTEGER
  USING (
    CASE
      WHEN "age" IS NULL OR btrim("age"::text) = '' THEN NULL
      WHEN btrim("age"::text) ~ '^[0-9]+$' THEN btrim("age"::text)::integer
      ELSE NULL
    END
  );
