-- 清理不完整的用户数据
-- 警告：此操作会删除没有 name、phone 或 password 的用户及其相关数据
-- 执行前请备份数据库！

BEGIN;

-- 1. 查看将被删除的用户
SELECT 
  id, 
  name, 
  phone, 
  CASE WHEN password IS NULL THEN 'NULL' ELSE '已设置' END as password_status,
  status,
  "createdAt"
FROM teachers 
WHERE name IS NULL OR phone IS NULL OR password IS NULL
ORDER BY "createdAt" DESC;

-- 2. 如果确认要删除，取消下面的注释并执行

-- 删除不完整的用户（CASCADE 会自动删除相关的任务提交、邀请记录等）
-- DELETE FROM teachers 
-- WHERE name IS NULL OR phone IS NULL OR password IS NULL;

-- 3. 查看删除后的统计
-- SELECT 
--   COUNT(*) as remaining_users,
--   COUNT(CASE WHEN name IS NOT NULL AND phone IS NOT NULL AND password IS NOT NULL THEN 1 END) as complete_users
-- FROM teachers;

COMMIT;
