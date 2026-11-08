-- 资料修改申请扩展为双类别：高考信息（SCORE_INFO）/ 资质变更（QUALIFICATION）
ALTER TABLE "teacher_info_change_requests" ADD COLUMN "requestKind" TEXT NOT NULL DEFAULT 'SCORE_INFO';
ALTER TABLE "teacher_info_change_requests" ADD COLUMN "qualificationChanges" JSONB;
