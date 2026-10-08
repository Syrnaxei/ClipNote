#!/usr/bin/env bash
# 组装 build/ 部署目录:docker-compose 配置 + 完整构建上下文,
# 在 build/ 内可直接 `docker compose up -d --build`。
# build/ 已被 .gitignore 忽略,定位为本地部署暂存区。
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BUILD="$ROOT/build"

log()   { echo "[build] $*"; }
step()  { echo; echo "==> $*"; }

# Windows 下独立窗口(Git Bash)运行时防止执行完毕窗口自动关闭;
# 从交互终端运行时按 Ctrl+C 退出即可
keep_window_open() {
    echo
    log "按 Ctrl+C 或直接关闭窗口退出"
    while :; do sleep 3600; done
}
trap keep_window_open EXIT

# ---------------------------------------------------------------------------
step "步骤 1/4:扫描零散的 docker-compose 文件"
#    范围:根目录及各子目录,移动至 build/(根目录不保留)
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

log "build/ 之外发现 ${#compose_matches[@]} 个 compose 文件"
moved=0
for f in "${compose_matches[@]}"; do
    dest="$BUILD/$(basename "$f")"
    if [ "$f" = "$dest" ]; then
        log "  跳过 ${f#"$ROOT"/}:已在 build/ 内"
        continue
    fi
    if [ -e "$dest" ]; then
        log "  跳过 ${f#"$ROOT"/}:build/ 中已存在同名文件,请手动处理"
        continue
    fi
    mv "$f" "$dest"
    log "  已移动 ${f#"$ROOT"/} -> build/$(basename "$f")"
    moved=$((moved + 1))
done
log "本步移动 $moved 个文件"

# ---------------------------------------------------------------------------
step "步骤 2/4:组装构建上下文(整体重建,保持幂等)"
# ---------------------------------------------------------------------------
rm -rf "$BUILD/server" "$BUILD/web" "$BUILD/caddy"
mkdir -p "$BUILD/server" "$BUILD/web" "$BUILD/caddy"

copy_server=(.dockerignore Dockerfile package.json package-lock.json tsconfig.json)
for f in "${copy_server[@]}"; do
    cp "$ROOT/server/$f" "$BUILD/server/$f"
    log "  server/$f"
done
cp -r "$ROOT/server/src" "$BUILD/server/src"
log "  server/src/ ($(find "$ROOT/server/src" -type f | wc -l) 个文件)"

copy_web=(.dockerignore Dockerfile package.json package-lock.json tsconfig.json
          vite.config.js vite.config.ts index.html)
for f in "${copy_web[@]}"; do
    cp "$ROOT/web/$f" "$BUILD/web/$f"
    log "  web/$f"
done
cp -r "$ROOT/web/src" "$BUILD/web/src"
log "  web/src/ ($(find "$ROOT/web/src" -type f | wc -l) 个文件)"
cp -r "$ROOT/web/public" "$BUILD/web/public"
log "  web/public/ ($(find "$ROOT/web/public" -type f | wc -l) 个文件)"

cp "$ROOT/caddy/Caddyfile" "$BUILD/caddy/Caddyfile"
log "  caddy/Caddyfile"
cp "$ROOT/.env.example" "$BUILD/.env.example"
log "  .env.example"

# ---------------------------------------------------------------------------
step "步骤 3/4:校验 compose 文件"
#    脚本执行后 compose 文件以 build/ 为唯一存放处
# ---------------------------------------------------------------------------
missing=0
for f in docker-compose.yml docker-compose.cn.yml; do
    if [ -f "$BUILD/$f" ]; then
        log "  就绪:build/$f"
    else
        log "  警告:缺少 $BUILD/$f"
        missing=$((missing + 1))
    fi
done
if [ "$missing" -gt 0 ]; then
    log "错误:缺失 $missing 个 compose 文件,请检查"
    exit 1
fi

# ---------------------------------------------------------------------------
step "步骤 4/4:完成"
# ---------------------------------------------------------------------------
file_count=$(find "$BUILD" -type f | wc -l)
log "build/ 已就绪,共 $file_count 个文件:"
while IFS= read -r -d '' f; do
    log "  ${f#"$BUILD"/}"
done < <(find "$BUILD" -maxdepth 2 -type f -print0 | sort -z)
echo
log "部署:cd build && docker compose up -d --build"
log "国内环境:cd build && docker compose -f docker-compose.cn.yml up -d --build"
