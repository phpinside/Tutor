# 数据库迁移总结

## 📋 概述

本文档总结了从 commit `a26e1b496846ba08789fd28176e2ae1c9de3a237` 到当前版本的所有数据库变更。

---

## 📂 迁移文件说明

| 文件名 | 说明 | 用途 |
|--------|------|------|
| `manual_production_migration.sql` | **生产环境迁移脚本** | 从旧版本迁移到新版本 |
| `current_schema_ddl.sql` | **当前完整表结构** | 新数据库从零创建的完整SQL |
| `PRODUCTION_MIGRATION_README.md` | **迁移指南** | 详细的迁移执行文档 |

---

## 🔄 变更详情

### 1️⃣ 枚举类型 (Enums)

#### 新增枚举
```sql
-- 邀请类型
CREATE TYPE "ReferralType" AS ENUM ('DIRECT', 'INDIRECT');
```

#### 扩展枚举
```sql
-- ReferralStatus 新增 PENDING 状态
ALTER TYPE "ReferralStatus" ADD VALUE 'PENDING';
-- 变更前: VALID, INVALID
-- 变更后: PENDING, VALID, INVALID
```

---

### 2️⃣ teachers 表变更

| 操作 | 字段/约束 | 说明 |
|------|----------|------|
| ➕ 新增字段 | `password TEXT` | 邀请人登录密码（bcrypt加密） |
| 🔒 新增约束 | `teachers_phone_key` UNIQUE | phone 字段唯一约束 |
| ➖ 删除字段 | `referralViewCode` | 旧的看板访问码（已废弃） |
| 📊 新增索引 | `teachers_phone_idx` | 提升 phone 查询性能 |
| 📊 新增索引 | `teachers_currentTaskIndex_idx` | 提升任务进度查询性能 |
| 📊 新增索引 | `teachers_createdAt_idx` | 提升时间范围查询性能 |

**字段变更对比**：
```diff
  CREATE TABLE "teachers" (
    "id" TEXT NOT NULL,
    "name" TEXT,
-   "phone" TEXT,              -- 无约束
+   "phone" TEXT,              -- 添加了 UNIQUE 约束
+   "password" TEXT,           -- 新增字段
    ...
-   "referralViewCode" TEXT,   -- 已删除
    "inviteCode" TEXT,
    ...
  );
```

---

### 3️⃣ referrals 表变更

| 操作 | 字段/约束 | 说明 |
|------|----------|------|
| 🔓 删除约束 | `referrals_referredId_key` | 允许同一人有多种邀请关系 |
| ➕ 新增字段 | `type ReferralType` | 邀请类型：DIRECT/INDIRECT |
| ➕ 新增字段 | `indirectReferrerId TEXT` | 间接邀请的中间人ID |
| 🔄 修改默认值 | `status` | 从 'VALID' 改为 'PENDING' |
| 🔒 新增约束 | 复合唯一约束 | (referrerId, referredId, type) |
| 📊 新增索引 | `referrals_referredId_idx` | 提升反向查询性能 |
| 📊 新增索引 | `referrals_type_idx` | 按类型查询 |
| 📊 新增索引 | `referrals_indirectReferrerId_idx` | 间接邀请查询 |

**字段变更对比**：
```diff
  CREATE TABLE "referrals" (
    "id" TEXT NOT NULL,
    "referrerId" TEXT NOT NULL,
-   "referredId" TEXT NOT NULL,  -- 有 UNIQUE 约束
+   "referredId" TEXT NOT NULL,  -- 移除 UNIQUE 约束
+   "type" "ReferralType" NOT NULL DEFAULT 'DIRECT',    -- 新增
+   "indirectReferrerId" TEXT,                           -- 新增
-   "status" "ReferralStatus" NOT NULL DEFAULT 'VALID', -- 旧默认值
+   "status" "ReferralStatus" NOT NULL DEFAULT 'PENDING', -- 新默认值
    ...
  );

+ -- 新增复合唯一约束
+ CREATE UNIQUE INDEX "referrals_referrerId_referredId_type_key" 
+   ON "referrals"("referrerId", "referredId", "type");
```

**业务逻辑变更说明**：
- ✅ 允许 A 同时直接邀请 B，并间接邀请 B（通过 C）
- ✅ 新邀请默认为"待审核"状态
- ✅ 可追踪间接邀请的传播路径

---

### 4️⃣ 新增表

#### system_configs 表
**用途**：存储系统配置参数（如奖励金额）

```sql
CREATE TABLE "system_configs" (
  "id" TEXT NOT NULL,
  "key" TEXT NOT NULL,          -- 配置键（唯一）
  "value" TEXT NOT NULL,        -- 配置值
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "system_configs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "system_configs_key_key" ON "system_configs"("key");
```

**预置配置**：
```sql
INSERT INTO system_configs (key, value) VALUES
  ('DIRECT_REWARD', '100'),    -- 直接邀请奖励100元
  ('INDIRECT_REWARD', '50');   -- 间接邀请奖励50元
```

---

#### referral_stats 表
**用途**：邀请统计和收益追踪

```sql
CREATE TABLE "referral_stats" (
  "id" TEXT NOT NULL,
  "teacherId" TEXT NOT NULL,    -- 唯一关联到 teachers
  
  -- 直接邀请统计
  "directTotal" INTEGER NOT NULL DEFAULT 0,
  "directValid" INTEGER NOT NULL DEFAULT 0,
  "directPending" INTEGER NOT NULL DEFAULT 0,
  "directInvalid" INTEGER NOT NULL DEFAULT 0,
  
  -- 间接邀请统计
  "indirectTotal" INTEGER NOT NULL DEFAULT 0,
  "indirectValid" INTEGER NOT NULL DEFAULT 0,
  "indirectPending" INTEGER NOT NULL DEFAULT 0,
  "indirectInvalid" INTEGER NOT NULL DEFAULT 0,
  
  -- 收益统计
  "totalEarnings" DOUBLE PRECISION NOT NULL DEFAULT 0,     -- 总收益
  "totalWithdrawn" DOUBLE PRECISION NOT NULL DEFAULT 0,    -- 已提现
  "pendingWithdrawal" DOUBLE PRECISION NOT NULL DEFAULT 0, -- 提现中
  "availableBalance" DOUBLE PRECISION NOT NULL DEFAULT 0,  -- 可提现
  
  "lastUpdated" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  
  CONSTRAINT "referral_stats_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "referral_stats_teacherId_fkey" 
    FOREIGN KEY ("teacherId") REFERENCES "teachers"("id") 
    ON DELETE CASCADE
);

CREATE UNIQUE INDEX "referral_stats_teacherId_key" ON "referral_stats"("teacherId");
```

---

## 📊 数据变更

### 现有数据处理

| 表 | 字段 | 变更 | 处理方式 |
|----|------|------|----------|
| `teachers` | `phone` | 添加唯一约束 | 重复的 phone 会被设为 NULL |
| `teachers` | `referralViewCode` | 删除字段 | 数据将丢失（已废弃功能） |
| `referrals` | `type` | 新增字段 | 所有现有记录设为 'DIRECT' |
| `referrals` | `status` | 默认值改变 | 现有记录保持不变 |

### 数据完整性保证

✅ 所有外键约束保持不变  
✅ 主键和索引保持不变  
✅ 现有数据不会丢失（除 referralViewCode）  
✅ 使用事务确保原子性

---

## 🚀 执行方式

### 方案 A：增量迁移（推荐用于生产环境）

```bash
# 1. 备份数据库
pg_dump $DATABASE_URL > backup_$(date +%Y%m%d_%H%M%S).sql

# 2. 执行迁移脚本
psql $DATABASE_URL -f prisma/migrations/manual_production_migration.sql

# 3. 验证结果
psql $DATABASE_URL -c "\d teachers"
psql $DATABASE_URL -c "SELECT type, COUNT(*) FROM referrals GROUP BY type;"
```

### 方案 B：全新部署（仅用于新数据库）

```bash
# 直接使用完整表结构
psql $DATABASE_URL -f prisma/migrations/current_schema_ddl.sql
```

---

## ✅ 迁移后验证清单

```sql
-- 1. 检查枚举类型
SELECT enumlabel FROM pg_enum 
WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'ReferralType');
-- 预期结果: DIRECT, INDIRECT

SELECT enumlabel FROM pg_enum 
WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'ReferralStatus');
-- 预期结果: PENDING, VALID, INVALID

-- 2. 检查 teachers 表
SELECT COUNT(*) FROM teachers WHERE password IS NOT NULL;
-- 预期：已注册的邀请人数量

SELECT phone, COUNT(*) FROM teachers WHERE phone IS NOT NULL 
GROUP BY phone HAVING COUNT(*) > 1;
-- 预期：无重复（空结果）

-- 3. 检查 referrals 表
SELECT type, status, COUNT(*) FROM referrals GROUP BY type, status;
-- 预期：能看到 DIRECT/INDIRECT 类型分布

-- 4. 检查新表
SELECT COUNT(*) FROM system_configs;
-- 预期：至少2条（DIRECT_REWARD, INDIRECT_REWARD）

SELECT COUNT(*) FROM referral_stats;
-- 预期：0（新表，需要通过应用程序填充）

-- 5. 检查索引
SELECT schemaname, tablename, indexname 
FROM pg_indexes 
WHERE tablename IN ('teachers', 'referrals', 'referral_stats')
ORDER BY tablename, indexname;
-- 预期：所有索引都已创建
```

---

## 🔙 回滚方案

如果迁移失败或需要回滚：

```sql
-- ⚠️ 警告：回滚会丢失迁移后的新数据！
-- 1. 从备份恢复
psql $DATABASE_URL < backup_YYYYMMDD_HHMMSS.sql

-- 或者

-- 2. 执行手动回滚（参见 PRODUCTION_MIGRATION_README.md）
```

---

## 📞 技术支持

**迁移问题排查**：
1. 查看错误日志
2. 检查 `PRODUCTION_MIGRATION_README.md` 的常见问题部分
3. 联系开发团队

**相关文档**：
- 📄 详细迁移指南：`PRODUCTION_MIGRATION_README.md`
- 📄 完整表结构：`current_schema_ddl.sql`
- 📄 迁移脚本：`manual_production_migration.sql`

---

**生成时间**：2026-01-09  
**目标版本**：Latest (after a26e1b4)  
**数据库版本**：PostgreSQL 12+
