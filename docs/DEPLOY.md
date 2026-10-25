# ClipNote 部署文档（Docker Compose）

> 依据 SPEC.md 第 7 节的部署架构：单容器 `app`（Node.js + SQLite），Express 自持
> 静态文件（SPA）+ `/api` + `/ws`；数据持久化于 named volume。可选叠加 Caddy 反代
> 扩展位接入 HTTPS/域名（见第 10 节）。

## 1. 架构说明

```
外部请求 (http://<IP>:31291)
        │
        ▼
   ┌────────────────────────────────┐
   │  app (Node.js, 单容器)          │
   │  Express + ws + better-sqlite3 │
   │  :3000                         │
   │  /        → 静态文件（SPA）     │
   │  /api/*   → 鉴权后进路由        │
   │  /ws      → WebSocket          │
   └───────────────┬────────────────┘
                   ▼
          SQLite 卷 clipnote-data
```

单服务：

| 服务 | 职责 | 常驻 |
|------|------|------|
| `app` | 静态文件托管（`express.static`，挂载于鉴权之前）+ REST API + WebSocket + SQLite，唯一对外端口 | 是 |

路由规则：`/` → 静态文件（SPA fallback 到 `index.html`，跳过 `/api/*` 与 `/ws`）；`/api/*` 与 `/ws` → Bearer API Key 鉴权。

## 2. 文件清单

```
clipnote/
├── app/Dockerfile            # 多阶段构建：web-build（Vite 产物）→ server-build（tsc+prune）
│                             #   → 运行时合并；better-sqlite3 v13 为 N-API 预编译二进制
│                             #   随包分发，构建无需任何编译工具链
├── caddy/Caddyfile           # 仅反代扩展使用：默认 :80 纯反代，顶部含 TLS 启用模板
├── docker-compose.yml        # 国际版（官方镜像源）
├── docker-compose.cn.yml     # 中国大陆专用版（镜像加速 + npmmirror）
├── docker-compose.proxy.yml  # 可选反代扩展 overlay（平时不启用）
├── .env.example              # 环境变量模板（复制为 .env 使用）
└── docs/DEPLOY.md            # 本文档
```

两版 compose 的服务编排完全一致，仅构建/拉取源不同：

| 差异点 | Normal（docker-compose.yml） | 中国大陆版（docker-compose.cn.yml） |
|--------|------------------------------|--------------------------------------|
| Docker 基础镜像 | Docker Hub 官方源 | `docker.m.daocloud.io`（DaoCloud 加速） |
| npm 依赖 | registry.npmjs.org | `registry.npmmirror.com`（淘宝源） |

> better-sqlite3 v13 起为 N-API 预编译二进制随 npm 包分发（含 linuxmusl/Alpine），
> 两版构建均不需要 Python/编译工具链，也不从 GitHub 下载任何产物。

## 3. 快速开始

前置要求：Docker Engine 20.10+ 与 Docker Compose v2（`docker compose version` 可查）。

```bash
# 1. 进入项目根目录
cd clipnote

# 2. 配置环境变量
cp .env.example .env
#    编辑 .env，设置强随机 API_KEY，例如：
#    openssl rand -hex 32          （Windows 可用 Git Bash 执行同条命令）

# 3. 构建并启动
docker compose up -d --build

# 4. 验证
curl -H "Authorization: Bearer <你的API_KEY>" http://localhost:31291/api/clipboards
#    浏览器打开 http://<服务器IP>:31291
```

中国大陆服务器使用专用版：

```bash
cp .env.example .env    # 同样先配置 API_KEY
docker compose -f docker-compose.cn.yml up -d --build
```

首次构建约需几分钟；中国版全程只走国内镜像源与 npm registry，不依赖 GitHub/Docker Hub 直连。

## 4. 环境变量

| 变量 | 必填 | 默认 | 说明 |
|------|------|------|------|
| `API_KEY` | 是 | — | API 鉴权 Key，所有 `/api/*` 与 `/ws` 请求需 `Authorization: Bearer <API_KEY>` |
| `CLIPNOTE_PORT` | 否 | `31291` | 对外端口，外部访问 `http://<IP>:<端口>` |

容器内部固定 `PORT=3000`、`DATA_DIR=/data`、`PUBLIC_DIR=/app/public`，无需修改。

## 5. 常用运维命令

```bash
# 查看日志
docker compose logs -f app

# 更新代码后重新部署（前后端一起重建进镜像）
docker compose up -d --build

# 停止 / 启动
docker compose down          # 数据保留在卷中，不受影响
docker compose up -d

# 完全重置（⚠️ 删除全部数据，慎用）
docker compose down -v
```

## 6. 数据备份与恢复

SQLite 数据库位于 named volume `clipnote-data` 中（容器内 `/data/clipnote.db`，WAL 模式）。

**在线备份（推荐）**：

```bash
docker compose exec app node -e \
  "require('better-sqlite3')('/data/clipnote.db').exec(\"VACUUM INTO '/data/backup.db'\")"
docker compose cp app:/data/backup.db ./clipnote-backup.db
```

**离线备份**：`docker compose down` 后执行

```bash
docker run --rm -v clipnote_clipnote-data:/data -v "$PWD":/backup alpine \
  cp /data/clipnote.db /backup/
```

> 卷名前缀为 compose 项目名（默认取目录名），实际名称以 `docker volume ls` 为准。
> 中国大陆版离线备份命令同样可用（alpine 镜像小，拉取一次即可；如拉取失败可换成
> `docker.m.daocloud.io/library/alpine:3.20`）。

恢复：停机后把备份的 `.db` 文件拷回 `/data/clipnote.db`，再 `up -d` 即可。

## 7. 从 ClipVault（旧名称）迁移

项目已由 ClipVault 更名为 ClipNote，旧部署升级时：

- **环境变量**：`.env` 中 `CLIPVAULT_PORT` 改为 `CLIPNOTE_PORT`（不设则默认 `31291`，行为不变）。
- **数据库文件**：server 启动时会自动把 `/data/clipvault.db` 重命名为 `clipnote.db`（含 WAL/SHM 附属文件），无需人工干预——前提是旧数据已在正确的卷中（见下）。
- **Docker 卷**：compose 卷名已从 `clipvault-data` 改为 `clipnote-data`，Docker 不支持卷重命名，需手动搬运数据：

```bash
docker compose down
docker volume ls                      # 找到旧卷，形如 <项目名>_clipvault-data
docker volume create <项目名>_clipnote-data
docker run --rm \
  -v <项目名>_clipvault-data:/from \
  -v <项目名>_clipnote-data:/to \
  alpine sh -c "cp -a /from/. /to/"
docker compose up -d --build
# 确认数据完好后再删除旧卷
docker volume rm <项目名>_clipvault-data
```

- **浏览器端**：主题、设备名、API Key 等 localStorage 设置会在首次打开新版页面时自动迁移，无需操作。
- **插件**：`/* ClipVault-Plugin */` 旧标记的 `.cvt` 插件仍可正常导入使用。

## 8. 换用其他镜像源

国内镜像加速站可用性时常变化。如某个源拉取失败，换源无需改 Dockerfile —— 在 `.env` 中覆盖变量即可（两版 compose 均支持变量覆盖）：

```dotenv
# 基础镜像
NODE_IMAGE=docker.1ms.run/library/node:22-alpine3.22
# 反代扩展（仅 proxy overlay 使用）
CADDY_IMAGE=docker.1ms.run/library/caddy:2-alpine
# npm 源（如需换）
NPM_REGISTRY=https://registry.npmmirror.com
```

改完执行 `docker compose -f docker-compose.cn.yml up -d --build` 重新构建。

**彻底方案**：在 Docker 守护进程配置 `/etc/docker/daemon.json` 中添加 registry-mirrors，则两版 compose 都可直接用官方镜像名：

```json
{
  "registry-mirrors": ["https://docker.m.daocloud.io", "https://docker.1ms.run"]
}
```

改后 `systemctl restart docker`（Windows/macOS 在 Docker Desktop 设置中配置）。

## 9. 常见问题

| 现象 | 处理 |
|------|------|
| `API_KEY is required` 报错 | 未创建 `.env` 或未设置 `API_KEY`，见第 3 节 |
| 拉取镜像超时/失败 | 用 `docker-compose.cn.yml`，或按第 8 节换源 |
| 页面打开但无数据/接口 401 | `.env` 的 `API_KEY` 与客户端（脚本/快捷指令）携带的不一致 |
| 修改前端代码不生效 | 必须带 `--build` 重新构建（前端产物在镜像构建期并入 `/app/public`） |
| WebSocket 无法连接 | 单容器内 ws 与 Express 同端口，检查是否走了对外端口而非直连容器 |

## 10. 可选：接入 HTTPS（反代扩展位）

单容器平时自持全部服务。未来需要 HTTPS/域名时，叠加反代扩展：

```bash
docker compose -f docker-compose.yml -f docker-compose.proxy.yml up -d
# 国内：docker compose -f docker-compose.cn.yml -f docker-compose.proxy.yml up -d
```

启用后 caddy 占用对外端口（`CLIPNOTE_PORT`，默认 31291），app 转为仅容器网络内可达。

上 TLS：

1. DNS 将域名解析到服务器，宿主机 443 可达；
2. 编辑 `caddy/Caddyfile`，把 `:80` 站点块替换为顶部注释中的域名模板；
3. `up -d` 重建 caddy，Caddy 自动签发并续期证书。

> 叠加 proxy 需 Docker Compose v2.24+（用到 `!reset` 覆盖语法，`docker compose version` 可查）。
> WebSocket 经 caddy 自动透传升级头，无需额外配置。

## 11. 从三容器旧版本升级

2026-10-25 前的部署为三容器（server/web/caddy），升级到单容器：

```bash
# 1. 同步新文件后直接重建（旧 server/caddy/web 容器由 compose 自动移除）
docker compose -f docker-compose.cn.yml up -d --build

# 2. 确认服务正常后清理孤儿卷（web 构建产物卷与 caddy 缓存卷，已无引用）
docker volume ls | grep -E 'web-dist|caddy'
docker volume rm <项目名>_web-dist <项目名>_caddy-data <项目名>_caddy-config
```

数据卷 `clipnote-data` 命名未变，数据无需迁移。`docker compose down` 不会删除 named volume，升级零数据风险。
