#!/usr/bin/env bash
# 组装 build/ 部署目录:docker-compose 配置 + 完整构建上下文,
# 在 build/ 内可直接 `docker compose up -d --build`。
# build/ 已被 .gitignore 忽略,定位为本地部署暂存区。
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BUILD="$ROOT/build"

log() { echo "[build] $*"; }

# ---------------------------------------------------------------------------
# 1. 收集零散的 docker-compose 文件(根目录及各子目录)移动至 build/
#    排除:build/ 自身、.git、node_modules、Preview、.scratch
# ---------------------------------------------------------------------------
shopt -s nullglob
compose_matches=()
while IFS= read -r -d '' f; do
    compose_matches+=("$f")
done < <(find "$ROOT" \
    \( -path "$BUILD" -o -name .git -o -name node_modules -o -name Preview -o -name .scratch \) -prune \
    -o -type f \( -name 'docker-compose*.yml' -o -name 'docker-compose*.yaml' \
                  -o -name 'compose*.yml' -o -name 'compose*.yaml' \) -print0)

for f in "${compose_matches[@]}"; do
    dest="$BUILD/$(basename "$f")"
    if [ "$f" = "$dest" ]; then
        continue
    fi
    if [ -e "$dest" ]; then
        log "跳过 $(realpath --relative-to="$ROOT" "$f"):build/ 中已存在同名文件"
        continue
    fi
    mv "$f" "$dest"
    log "移动 compose 文件 -> build/$(basename "$f")"
done

# ---------------------------------------------------------------------------
# 2. 刷新构建上下文(整体重建,保持幂等)
# ---------------------------------------------------------------------------
rm -rf "$BUILD/server" "$BUILD/web" "$BUILD/caddy"
mkdir -p "$BUILD/server" "$BUILD/web" "$BUILD/caddy"

copy_server=(.dockerignore Dockerfile package.json package-lock.json tsconfig.json)
for f in "${copy_server[@]}"; do
    cp "$ROOT/server/$f" "$BUILD/server/$f"
done
cp -r "$ROOT/server/src" "$BUILD/server/src"

copy_web=(.dockerignore Dockerfile package.json package-lock.json tsconfig.json
          vite.config.js vite.config.ts index.html)
for f in "${copy_web[@]}"; do
    cp "$ROOT/web/$f" "$BUILD/web/$f"
done
cp -r "$ROOT/web/src" "$BUILD/web/src"
cp -r "$ROOT/web/public" "$BUILD/web/public"

cp "$ROOT/caddy/Caddyfile" "$BUILD/caddy/Caddyfile"
cp "$ROOT/.env.example" "$BUILD/.env.example"

# ---------------------------------------------------------------------------
# 3. 校验 compose 文件(脚本执行后 compose 文件以 build/ 为唯一存放处)
# ---------------------------------------------------------------------------
for f in docker-compose.yml docker-compose.cn.yml; do
    if [ -f "$BUILD/$f" ]; then
        log "compose 就绪:build/$f"
    else
        log "警告:缺少 $BUILD/$f"
    fi
done

log "完成。部署:cd build && docker compose up -d --build(国内环境加 -f docker-compose.cn.yml)"
