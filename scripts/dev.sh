#!/usr/bin/env bash
# 一键启动 ClipNote 前后端开发环境（详见 docs/DEV.md）
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# 读取根目录 .env 中的 API_KEY（环境变量优先）
if [[ -z "${API_KEY:-}" && -f "$ROOT_DIR/.env" ]]; then
  API_KEY="$(grep -E '^API_KEY=' "$ROOT_DIR/.env" | head -1 | cut -d= -f2- | tr -d '\r')"
  export API_KEY
fi

if [[ -z "${API_KEY:-}" ]]; then
  echo "错误：未设置 API_KEY。" >&2
  echo "用法：API_KEY=<密钥> bash scripts/dev.sh，或在项目根目录创建 .env 文件写入 API_KEY=<密钥>" >&2
  exit 1
fi

for dir in server web; do
  if [[ ! -d "$ROOT_DIR/$dir/node_modules" ]]; then
    echo "==> 首次运行，安装 $dir 依赖..."
    (cd "$ROOT_DIR/$dir" && npm install)
  fi
done

echo "==> 启动 server (http://localhost:3000)"
(cd "$ROOT_DIR/server" && npm run dev) &
SERVER_PID=$!

echo "==> 启动 web    (http://localhost:5173)"
(cd "$ROOT_DIR/web" && npm run dev) &
WEB_PID=$!

CLEANED=0
cleanup() {
  [[ $CLEANED -eq 1 ]] && return
  CLEANED=1
  echo
  echo "==> 正在停止服务..."
  if command -v taskkill >/dev/null 2>&1; then
    # Windows: 连同 npm 派生的子进程一起结束
    taskkill //PID "$SERVER_PID" //T //F >/dev/null 2>&1
    taskkill //PID "$WEB_PID" //T //F >/dev/null 2>&1
  else
    kill "$SERVER_PID" "$WEB_PID" 2>/dev/null
  fi
}
trap cleanup EXIT INT TERM

echo
echo "==> 就绪：浏览器打开 http://localhost:5173 （API Key 即 API_KEY）"
echo "==> Ctrl+C 停止全部服务"
wait
