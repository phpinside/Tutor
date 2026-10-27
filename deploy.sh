#root@eduflow:/opt/tutor/Tutor# ExFXifTeJnkrinmcMuWQ
#root@eduflow:/opt/tutor/Tutor# psql -h localhost -p 5432 -U tutor -d tutor_onboarding <<'EOF'
# CREATE INDEX "coach_reviews_finalReviewOperatorId_idx" ON "coach_reviews"("finalReviewOperatorId");
#EOF
#Password for user tutor:

npm run db:generate && npm run build && systemctl restart tutor.service

