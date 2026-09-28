-- 复审随机分配：CoachReview 增加复审运营ID
ALTER TABLE "coach_reviews" ADD COLUMN "finalReviewOperatorId" TEXT;
CREATE INDEX "coach_reviews_finalReviewOperatorId_idx" ON "coach_reviews"("finalReviewOperatorId");
