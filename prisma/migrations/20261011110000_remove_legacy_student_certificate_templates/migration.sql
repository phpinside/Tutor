-- Generated certificates retain their own image and template name snapshots.
DELETE FROM "student_certificate_templates"
WHERE "id" IN ('classic', 'modern', 'cartoon', 'academic', 'elegant', 'portrait');

UPDATE "student_certificate_templates"
SET "sortOrder" = CASE "id"
  WHEN 'royal' THEN 0
  WHEN 'azure' THEN 1
  WHEN 'british' THEN 2
  WHEN 'blackGold' THEN 3
  WHEN 'scholar' THEN 4
  WHEN 'champagne' THEN 5
  WHEN 'sunshine' THEN 6
  WHEN 'laurel' THEN 7
END
WHERE "id" IN ('royal', 'azure', 'british', 'blackGold', 'scholar', 'champagne', 'sunshine', 'laurel');
