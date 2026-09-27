-- 新增「运营」角色（OPERATOR）：与学管（LEARNER_MANAGER）并列
-- 学管 = 数据可见范围收敛为白名单；运营 = 保持完整可见范围
-- 存量账号不受影响（保持 LEARNER_MANAGER）

ALTER TYPE "OperatorRole" ADD VALUE IF NOT EXISTS 'OPERATOR';
