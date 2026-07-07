#!/bin/bash

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
PID_FILE="$PROJECT_DIR/.dev-server.pid"
PORT=3000

is_running() {
  if [[ -f "$PID_FILE" ]]; then
    local pid
    pid=$(cat "$PID_FILE")
    if kill -0 "$pid" 2>/dev/null; then
      return 0
    fi
  fi
  # 兜底：按端口查找
  local port_pid
  port_pid=$(lsof -ti:$PORT 2>/dev/null)
  if [[ -n "$port_pid" ]]; then
    return 0
  fi
  return 1
}

get_pid() {
  local pid
  pid=$(cat "$PID_FILE" 2>/dev/null)
  if [[ -n "$pid" ]] && kill -0 "$pid" 2>/dev/null; then
    echo "$pid"
    return
  fi
  pid=$(lsof -ti:$PORT 2>/dev/null)
  if [[ -n "$pid" ]]; then
    echo "$pid"
  fi
}

start_server() {
  if is_running; then
    echo "⚠ 服务已在运行 (PID: $(get_pid))，端口 $PORT"
    exit 0
  fi

  echo "▶ 启动开发服务器..."
  cd "$PROJECT_DIR"
  nohup npm run dev > /tmp/tutor-dev.log 2>&1 &
  echo $! > "$PID_FILE"

  # 等待服务就绪
  echo -n "  等待启动"
  for i in $(seq 1 30); do
    if curl -s -o /dev/null -w '' http://localhost:$PORT/ 2>/dev/null; then
      echo ""
      echo "✅ 服务已启动: http://localhost:$PORT"
      echo "   日志: /tmp/tutor-dev.log"
      echo "   PID:  $(cat "$PID_FILE")"
      echo ""
      echo "入口："
      echo "  超管后台  http://localhost:$PORT/admin/login        (admin / admin123)"
      echo "  学管后台  http://localhost:$PORT/operator/login    (13800000001 / 123456)"
      echo "  教练注册  http://localhost:$PORT/auth/register"
      echo "  教练引导  http://localhost:$PORT/onboarding"
      exit 0
    fi
    echo -n "."
    sleep 1
  done

  echo ""
  echo "❌ 启动超时，请检查日志: /tmp/tutor-dev.log"
  exit 1
}

stop_server() {
  if ! is_running; then
    echo "○ 服务未运行"
    rm -f "$PID_FILE"
    exit 0
  fi

  local pid
  pid=$(get_pid)
  echo "■ 停止服务 (PID: $pid)..."
  kill "$pid" 2>/dev/null

  for i in $(seq 1 10); do
    if ! kill -0 "$pid" 2>/dev/null; then
      break
    fi
    sleep 1
  done

  # 强制兜底
  if kill -0 "$pid" 2>/dev/null; then
    echo "  强制终止..."
    kill -9 "$pid" 2>/dev/null
  fi

  # 清理同端口残留进程
  lsof -ti:$PORT 2>/dev/null | xargs kill -9 2>/dev/null

  rm -f "$PID_FILE"
  echo "✅ 已停止"
}

restart_server() {
  echo "🔄 重启服务..."
  stop_server
  sleep 1
  start_server
}

status_server() {
  if is_running; then
    echo "● 服务运行中 (PID: $(get_pid))  端口 $PORT"
  else
    echo "○ 服务未运行"
  fi
}

open_urls() {
  local base="http://localhost:$PORT"
  echo "🌐 打开各角色入口："
  echo ""
  echo "  [1] 超管后台  $base/admin/login"
  echo "      账号: admin / admin123"
  echo ""
  echo "  [2] 学管后台  $base/operator/login"
  echo "      账号: 13800000001 / 123456"
  echo ""
  echo "  [3] 教练注册  $base/auth/register"
  echo ""
  echo "  [4] 教练引导  $base/onboarding"
  echo "      (需先登录，注册或 teacherId cookie 有效)"
  echo ""
  /usr/bin/open "$base/admin/login"
}

case "${1:-}" in
  start)   start_server ;;
  stop)    stop_server ;;
  restart) restart_server ;;
  status)  status_server ;;
  open)    open_urls ;;
  *)
    echo "用法: ./dev.sh {start|stop|restart|status|open}"
    echo ""
    echo "  start   启动开发服务器 (端口 $PORT)"
    echo "  stop    停止服务"
    echo "  restart 重启服务"
    echo "  status  查看运行状态"
    echo "  open    在浏览器打开各角色入口"
    exit 1
    ;;
esac
