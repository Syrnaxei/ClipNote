#!/usr/bin/env bash
# 组装 docker/ 部署目录:docker-compose 配置 + 完整构建上下文,
# 在 docker/ 内可直接 `docker compose up -d --build`。
# docker/ 已被 .gitignore 忽略,定位为本地部署暂存区;
# Dockerfile 与 .dockerignore 以仓库根目录为准(与 CI 一致),每次组装时同步复制到 docker/app/。
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DOCKER="$ROOT/docker"
APP="$DOCKER/app"

log()   { echo "[build] $*"; }
step()  { echo; echo "==> $*"; }

# Windows 下独立窗口(Git Bash)运行时防止执行完毕窗口自动关闭;
# 从交互终端运行时按 Ctrl+C 退出即可;CI=true 时跳过,避免脚本化运行挂起
keep_window_open() {
    if [ "${CI:-}" = "true" ]; then
        return
    fi
    echo
    log "按 Ctrl+C 或直接关闭窗口退出"
    while :; do sleep 3600; done
}
trap keep_window_open EXIT

# ---------------------------------------------------------------------------
step "步骤 1/4:扫描零散的 docker-compose 文件"
#    范围:根目录及各子目录,移动至 docker/(根目录不保留)
#    排除:docker/ 自身、.git、node_modules、Preview、.scratch
# ---------------------------------------------------------------------------
shopt -s nullglob
compose_matches=()
while IFS= read -r -d '' f; do
    compose_matches+=("$f")
done < <(find "$ROOT" \
    \( -path "$DOCKER" -o -name .git -o -name node_modules -o -name Preview -o -name .scratch \) -prune \
    -o -type f \( -name 'docker-compose*.yml' -o -name 'docker-compose*.yaml' \
                  -o -name 'compose*.yml' -o -name 'compose*.yaml' \) -print0)

log "docker/ 之外发现 ${#compose_matches[@]} 个 compose 文件"
moved=0
for f in "${compose_matches[@]}"; do
    dest="$DOCKER/$(basename "$f")"
    if [ "$f" = "$dest" ]; then
        log "  跳过 ${f#"$ROOT"/}:已在 docker/ 内"
        continue
    fi
    if [ -e "$dest" ]; then
        log "  跳过 ${f#"$ROOT"/}:docker/ 中已存在同名文件,请手动处理"
        continue
    fi
    mv "$f" "$dest"
    log "  已移动 ${f#"$ROOT"/} -> docker/$(basename "$f")"
    moved=$((moved + 1))
done
log "本步移动 $moved 个文件"

# ---------------------------------------------------------------------------
step "步骤 2/4:组装构建上下文(整体重建,保持幂等)"
#    单容器架构:docker/app/ 为本地部署构建上下文,内含 server/ 与 web/ 子目录;
#    Dockerfile 与 .dockerignore 每次从仓库根目录复制,保证与 CI 构建一致
# ---------------------------------------------------------------------------
rm -rf "$APP/server" "$APP/web"
mkdir -p "$APP/server" "$APP/web"

for f in Dockerfile .dockerignore; do
    cp "$ROOT/$f" "$APP/$f"
    log "  app/$f"
done

copy_server=(package.json package-lock.json tsconfig.json)
for f in "${copy_server[@]}"; do
    cp "$ROOT/server/$f" "$APP/server/$f"
    log "  app/server/$f"
done
cp -r "$ROOT/server/src" "$APP/server/src"
log "  app/server/src/ ($(find "$ROOT/server/src" -type f | wc -l) 个文件)"

copy_web=(package.json package-lock.json tsconfig.json
          vite.config.js vite.config.ts index.html)
for f in "${copy_web[@]}"; do
    cp "$ROOT/web/$f" "$APP/web/$f"
    log "  app/web/$f"
done
cp -r "$ROOT/web/src" "$APP/web/src"
log "  app/web/src/ ($(find "$ROOT/web/src" -type f | wc -l) 个文件)"
cp -r "$ROOT/web/public" "$APP/web/public"
log "  app/web/public/ ($(find "$ROOT/web/public" -type f | wc -l) 个文件)"

cp "$ROOT/.env.example" "$DOCKER/.env.example"
log "  .env.example"

# ---------------------------------------------------------------------------
# 步骤 3/4:校验常驻配置
#    compose 文件、caddy/Caddyfile 常驻 docker/,脚本不覆盖,仅校验
# ---------------------------------------------------------------------------
missing=0
for f in docker-compose.yml docker-compose.cn.yml docker-compose.proxy.yml; do
    if [ -f "$DOCKER/$f" ]; then
        log "  就绪:docker/$f"
    else
        log "  警告:缺少 $DOCKER/$f"
        missing=$((missing + 1))
    fi
done
if [ -f "$DOCKER/caddy/Caddyfile" ]; then
    log "  就绪:docker/caddy/Caddyfile"
else
    log "  警告:缺少 $DOCKER/caddy/Caddyfile"
    missing=$((missing + 1))
fi
if [ -f "$APP/Dockerfile" ]; then
    log "  就绪:docker/app/Dockerfile"
else
    log "  警告:缺少 $APP/Dockerfile"
    missing=$((missing + 1))
fi
if [ -f "$APP/.dockerignore" ]; then
    log "  就绪:docker/app/.dockerignore"
else
    log "  警告:缺少 $APP/.dockerignore"
    missing=$((missing + 1))
fi
if [ "$missing" -gt 0 ]; then
    log "错误:缺失 $missing 个常驻配置文件,请检查"
    exit 1
fi

# ---------------------------------------------------------------------------
step "步骤 4/4:完成"
# ---------------------------------------------------------------------------
file_count=$(find "$DOCKER" -type f | wc -l)
log "docker/ 已就绪,共 $file_count 个文件:"
while IFS= read -r -d '' f; do
    log "  ${f#"$DOCKER"/}"
done < <(find "$DOCKER" -maxdepth 3 -type f -not -path "$APP/server/src/*" -not -path "$APP/web/src/*" -not -path "$APP/web/public/*" -print0 | sort -z)
echo
log "部署:cd docker && docker compose up -d --build"
log "国内环境:cd docker && docker compose -f docker-compose.cn.yml up -d --build"