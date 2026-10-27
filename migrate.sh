#!/bin/bash

set -e  # 遇到错误立即退出

# ========== 配置区域 ==========
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ENV_FILE="${SCRIPT_DIR}/.env"
SQL_FILE="${1:-${SCRIPT_DIR}/migration.sql}"   # 默认执行同目录的 migration.sql，也可通过参数指定
# ==============================

if [ ! -f "$ENV_FILE" ]; then
    echo "❌ 错误: .env 文件不存在 ($ENV_FILE)"
    exit 1
fi

if [ ! -f "$SQL_FILE" ]; then
    echo "❌ 错误: SQL 文件不存在 ($SQL_FILE)"
    echo "   用法: $0 [sql文件路径]"
    exit 1
fi

set -a
source "$ENV_FILE"
set +a

# 校验必要变量
if [ -z "$DB_HOST" ] || [ -z "$DB_NAME" ] || [ -z "$DB_USER" ] || [ -z "$DB_PASS" ]; then
    echo "❌ 错误: .env 文件缺少必要配置"
    exit 1
fi

echo "📋 数据库变更任务"
echo "   主机: ${DB_HOST}:${DB_PORT}"
echo "   数据库: ${DB_NAME}"
echo "   用户: ${DB_USER}"
echo "   SQL 文件: ${SQL_FILE}"
echo "----------------------------------------"

# 执行 SQL 文件
PGPASSWORD="$DB_PASS" psql \
    -U "$DB_USER" \
    -h "$DB_HOST" \
    -p "$DB_PORT" \
    -d "$DB_NAME" \
    -v ON_ERROR_STOP=1 \
    -f "$SQL_FILE"

echo "----------------------------------------"
echo "✅ 数据库变更执行完成！"
