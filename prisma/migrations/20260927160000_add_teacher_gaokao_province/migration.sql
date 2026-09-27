-- 老师新增「参加高考的省份」属性（新手引导表单必填；存量老师为空，可由超管补录）
ALTER TABLE "teachers" ADD COLUMN "gaokaoProvince" TEXT;
