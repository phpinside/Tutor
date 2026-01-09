# 生产环境数据库迁移指南

## 概述

本文档说明如何将生产数据库从 commit `a26e1b496846ba08789fd28176e2ae1c9de3a237` 迁移到当前版本。

## 变更摘要

### 新增功能
- ✅ 邀请人登录系统（手机号 + 密码）
- ✅ 直接/间接邀请分类跟踪
- ✅ 邀请状态审核流程（待审核 → 有效/无效）
- ✅ 系统配置管理（奖励金额等）
- ✅ 邀请统计数据（收益追踪）

### 数据库变更

#### 1. 枚举类型
- 新增 `ReferralType` 枚举（DIRECT, INDIRECT）
- `ReferralStatus` 新增 `PENDING` 状态

#### 2. teachers 表
- ➕ `password` 字段（用于邀请人登录）
- 🔒 `phone` 添加唯一约束
- ➖ 删除 `referralViewCode` 字段
- 📊 新增索引：`phone_idx`, `currentTaskIndex_idx`, `createdAt_idx`

#### 3. referrals 表
- 🔓 移除 `referredId` 唯一约束（支持一人多种邀请关系）
- ➕ `type` 字段（邀请类型：直接/间接）
- ➕ `indirectReferrerId` 字段（间接邀请中间人）
- 🔄 `status` 默认值改为 `PENDING`
- 🔒 新增复合唯一约束：`(referrerId, referredId, type)`
- 📊 新增索引：`referredId_idx`, `type_idx`, `indirectReferrerId_idx`

#### 4. 新表
- 📋 `system_configs` - 系统配置表
- 📊 `referral_stats` - 邀请统计表

## 迁移文件

主迁移文件：[`manual_production_migration.sql`](./manual_production_migration.sql)

## 执行前准备

### 1. 备份数据库

**强烈建议在执行迁移前备份生产数据库！**

```bash
# PostgreSQL 备份
pg_dump -h <host> -U <user> -d <database> -F c -f backup_$(date +%Y%m%d_%H%M%S).dump

# 或者使用 plain SQL 格式
pg_dump -h <host> -U <user> -d <database> > backup_$(date +%Y%m%d_%H%M%S).sql
```

### 2. 在测试环境验证

建议先在测试环境执行迁移脚本，验证没有问题后再在生产环境执行。

```bash
# 恢复备份到测试环境
pg_restore -h <test-host> -U <user> -d <test-database> backup.dump

# 在测试环境执行迁移
psql -h <test-host> -U <user> -d <test-database> -f prisma/migrations/manual_production_migration.sql
```

### 3. 检查数据完整性

执行前检查可能的数据冲突：

```sql
-- 检查是否有重复的 phone 号码
SELECT phone, COUNT(*) 
FROM teachers 
WHERE phone IS NOT NULL 
GROUP BY phone 
HAVING COUNT(*) > 1;

-- 检查现有的 referrals 记录
SELECT COUNT(*) FROM referrals;
SELECT status, COUNT(*) FROM referrals GROUP BY status;
```

## 执行迁移

### 方法 1: 使用 psql 命令行工具

```bash
# 基本执行
psql -h <host> -U <user> -d <database> -f prisma/migrations/manual_production_migration.sql

# 带详细输出
psql -h <host> -U <user> -d <database> -f prisma/migrations/manual_production_migration.sql -v ON_ERROR_STOP=1

# 使用环境变量
export DATABASE_URL="postgresql://user:password@host:5432/database"
psql $DATABASE_URL -f prisma/migrations/manual_production_migration.sql
```

### 方法 2: 使用 Prisma CLI（不推荐用于此场景）

```bash
# 注意：Prisma 可能会创建新的迁移记录
# 本脚本是手动整合的，建议直接用 psql 执行
```

### 方法 3: 通过数据库管理工具

使用 pgAdmin、DBeaver、TablePlus 等工具：
1. 连接到生产数据库
2. 打开 SQL 查询窗口
3. 粘贴 `manual_production_migration.sql` 内容
4. 执行脚本

## 迁移特性

### ✅ 幂等性（Idempotent）

脚本可以安全地多次执行，已应用的变更会被跳过：

```sql
-- 示例：检查约束是否存在
IF NOT EXISTS (
  SELECT 1 FROM pg_constraint 
  WHERE conname = 'teachers_phone_key'
) THEN
  ALTER TABLE "teachers" ADD CONSTRAINT "teachers_phone_key" UNIQUE ("phone");
END IF;
```

### ✅ 事务保护

整个迁移在一个事务中执行，失败时自动回滚：

```sql
BEGIN;
-- ... 所有迁移操作 ...
COMMIT;
```

### ✅ 并发索引创建

使用 `CONCURRENTLY` 避免锁表：

```sql
CREATE INDEX CONCURRENTLY IF NOT EXISTS "teachers_phone_idx" ON "teachers"("phone");
```

### ⚠️ 注意事项

1. **重复 phone 处理**：脚本会将重复的 phone 设置为 NULL。如需保留数据，请修改相关逻辑。

2. **索引创建时间**：`CONCURRENTLY` 创建索引不会锁表，但需要更长时间。

3. **默认配置值**：脚本会插入默认的奖励配置（直接邀请100元，间接邀请50元），可按需修改。

## 执行后验证

### 1. 检查迁移结果

```sql
-- 检查枚举类型
SELECT enumlabel FROM pg_enum 
WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'ReferralType');

SELECT enumlabel FROM pg_enum 
WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'ReferralStatus');

-- 检查表结构
\d teachers
\d referrals
\d system_configs
\d referral_stats

-- 检查索引
SELECT indexname, indexdef FROM pg_indexes 
WHERE tablename IN ('teachers', 'referrals', 'referral_stats');

-- 检查约束
SELECT conname, contype FROM pg_constraint 
WHERE conrelid IN (
  'teachers'::regclass, 
  'referrals'::regclass,
  'system_configs'::regclass,
  'referral_stats'::regclass
);
```

### 2. 验证数据完整性

```sql
-- 检查 referrals 的 type 字段
SELECT type, COUNT(*) FROM referrals GROUP BY type;

-- 检查系统配置
SELECT * FROM system_configs;

-- 检查是否有 password 字段
SELECT COUNT(*) as teachers_with_password 
FROM teachers 
WHERE password IS NOT NULL;

-- 检查 phone 唯一性
SELECT phone, COUNT(*) 
FROM teachers 
WHERE phone IS NOT NULL 
GROUP BY phone 
HAVING COUNT(*) > 1;
```

### 3. 测试应用功能

- ✅ 邀请人登录功能
- ✅ 邀请记录创建
- ✅ 邀请统计查询
- ✅ 系统配置读取

## 回滚方案

如果迁移出现问题，可以执行以下回滚操作：

```sql
BEGIN;

-- 1. 删除新表
DROP TABLE IF EXISTS "referral_stats";
DROP TABLE IF EXISTS "system_configs";

-- 2. 恢复 referrals 表
ALTER TABLE "referrals" DROP CONSTRAINT IF EXISTS "referrals_referrerId_referredId_type_key";
ALTER TABLE "referrals" DROP COLUMN IF EXISTS "indirectReferrerId";
ALTER TABLE "referrals" DROP COLUMN IF EXISTS "type";
ALTER TABLE "referrals" ADD CONSTRAINT "referrals_referredId_key" UNIQUE ("referredId");
ALTER TABLE "referrals" ALTER COLUMN "status" SET DEFAULT 'VALID';

-- 3. 恢复 teachers 表
ALTER TABLE "teachers" DROP CONSTRAINT IF EXISTS "teachers_phone_key";
ALTER TABLE "teachers" DROP COLUMN IF EXISTS "password";
ALTER TABLE "teachers" ADD COLUMN IF NOT EXISTS "referralViewCode" TEXT;
DROP INDEX IF EXISTS "teachers_phone_idx";
DROP INDEX IF EXISTS "teachers_currentTaskIndex_idx";
DROP INDEX IF EXISTS "teachers_createdAt_idx";

-- 4. 删除枚举类型（需要先确保没有使用）
-- DROP TYPE IF EXISTS "ReferralType";
-- 注意：无法从枚举中删除值，需要重建枚举

COMMIT;
```

**警告**：回滚会丢失迁移后新增的数据（如 referral_stats），请谨慎操作！

## 常见问题

### Q1: 迁移失败怎么办？

由于使用了事务，失败会自动回滚。检查错误信息，解决问题后重新执行。

### Q2: 可以部分执行吗？

不建议。整个脚本设计为一个原子操作。如需部分执行，请仔细审查依赖关系。

### Q3: 如何处理重复的 phone？

脚本默认将重复的 phone 设置为 NULL。如需保留，请在执行前手动处理重复数据。

### Q4: 执行需要多长时间？

取决于数据量。小型数据库（< 10万条记录）通常在几秒内完成。大型数据库可能需要几分钟。

### Q5: 会锁表吗？

大部分操作很快。索引使用 `CONCURRENTLY` 创建，不会完全锁表，但可能影响性能。建议在低峰期执行。

## 技术支持

如有问题，请联系开发团队或查看项目文档。

---

**最后更新**: 2026-01-09  
**版本**: 1.0.0  
**目标数据库**: PostgreSQL 12+
