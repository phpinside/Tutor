-- 邀请奖励：记录级授课达标时间
-- 自 2026-10-01 起授课奖励门槛（直接/间接邀请相同）由 10 课时统一提高到 20 课时，
-- 新增记录级字段 teachingCompletedAt 记录每条邀请记录的达标时间；
-- 历史达标记录（旧规则一次性全部标记，均写过 verifiedAt）回填为 verifiedAt，保证统计口径连续。

ALTER TABLE "referrals" ADD COLUMN IF NOT EXISTS "teachingCompletedAt" TIMESTAMP(3);

UPDATE "referrals" SET "teachingCompletedAt" = "verifiedAt"
WHERE "verifiedAt" IS NOT NULL AND "teachingCompletedAt" IS NULL;
