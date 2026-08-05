#!/usr/bin/env bash
# ============================================================
# 关系决策牌组 - 本地预览启动脚本
# 固定使用 4111 端口（避免与常见的 8000/8080 冲突）
# 用法：
#   ./serve.sh          # 前台运行（Ctrl+C 停止）
#   ./serve.sh --bg     # 后台运行（输出日志到 serve.log）
# ============================================================
set -u

PORT=4111
BIND=127.0.0.1
# 优先用 WorkBuddy 管理的 python，回退到系统 python3
PY_BIN="/Users/ray/.workbuddy/binaries/python/versions/3.13.12/bin/python3"
command -v "$PY_BIN" >/dev/null 2>&1 || PY_BIN="python3"

cd "$(dirname "$0")" || exit 1

# --- 注入构建版本号 (git commit short hash) ---
if command -v git >/dev/null 2>&1 && git rev-parse --git-dir >/dev/null 2>&1; then
  HASH=$(git rev-parse --short HEAD 2>/dev/null || echo "dev")
  if command -v sed >/dev/null 2>&1; then
    sed -i '' "s|window\.__APP_BUILD__ = '[^']*'|window.__APP_BUILD__ = '$HASH'|" index.html 2>/dev/null || true
    echo "📦 构建版本: $HASH"
  fi
fi

# --- 端口占用自检 ---
if command -v lsof >/dev/null 2>&1; then
  OCC=$(lsof -iTCP:"$PORT" -sTCP:LISTEN -P -n 2>/dev/null | tail -n +2)
  if [ -n "$OCC" ]; then
    echo "⚠️  端口 $PORT 已被占用："
    echo "$OCC"
    echo "请先释放该端口，或修改脚本顶部的 PORT 变量。"
    exit 1
  fi
fi

echo "🚀 启动预览服务器 -> http://$BIND:$PORT"
echo "   项目目录: $(pwd)"
echo "   停止方式: 前台运行按 Ctrl+C；后台运行执行 pkill -f 'http.server $PORT'"
echo ""

if [ "${1:-}" = "--bg" ]; then
  nohup "$PY_BIN" -m http.server "$PORT" --bind "$BIND" >serve.log 2>&1 &
  sleep 1
  if curl -s -o /dev/null -w "%{http_code}" "http://$BIND:$PORT/index.html" | grep -q 200; then
    echo "✅ 已在后台启动，访问: http://localhost:$PORT  (日志: serve.log)"
  else
    echo "❌ 启动失败，请查看 serve.log"
    exit 1
  fi
else
  exec "$PY_BIN" -m http.server "$PORT" --bind "$BIND"
fi
