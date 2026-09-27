-- 学管角色改造：Operator.role 枚举 + 审计日志表 + Teacher.invitedById 索引
-- 纯增量迁移：无列删除、无数据改写；存量运营自动迁移为 LEARNER_MANAGER（默认值）
-- 回滚：无需 down migration（新增列/表/索引留在库中无害，代码回退即可）

-- 1. 角色枚举
CREATE TYPE "OperatorRole" AS ENUM ('LEARNER_MANAGER');

-- 2. Operator 增加 role 列（默认值即完成存量运营 → 学管的迁移）
ALTER TABLE "operators" ADD COLUMN "role" "OperatorRole" NOT NULL DEFAULT 'LEARNER_MANAGER';

-- 3. 学管白名单条件 C 主查询路径索引
CREATE INDEX "teachers_invitedById_idx" ON "teachers"("invitedById");

-- 4. 审计日志表
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "actorType" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "actorName" TEXT,
    "action" TEXT NOT NULL,
    "targetType" TEXT,
    "targetId" TEXT,
    "detail" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "audit_logs_actorId_createdAt_idx" ON "audit_logs"("actorId", "createdAt");
CREATE INDEX "audit_logs_targetType_targetId_idx" ON "audit_logs"("targetType", "targetId");
CREATE INDEX "audit_logs_action_createdAt_idx" ON "audit_logs"("action", "createdAt");
