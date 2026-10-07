# ClipNote 部署文档（Docker Compose）

> 依据 SPEC.md 第 7 节的部署架构：Caddy（反向代理 + 静态托管）→ server（Node.js + SQLite），
> 前端构建产物经共享 volume 交给 Caddy，数据持久化于 named volume。

## 1. 架构说明

```
外部请求 (http://<IP>:31291)
        │
        ▼
   ┌─────────┐   /api/*, /ws    ┌────────────────────┐
   │  caddy  │ ───────────────► │  server (Node.js)  │
   │  :80    │                  │  Express + ws      │
   │ 静态文件 │                  │  better-sqlite3    │
   └─────────┘                  └─────────┬──────────┘
        ▲                                 │
        │ web-dist 卷（构建产物）          ▼
   ┌─────────┐                      SQLite 卷 clipnote-data
   │   web   │ （构建后退出）
   └─────────┘
```

三个服务：

| 服务 | 职责 | 常驻 |
|------|------|------|
| `server` | REST API + WebSocket + SQLite，不对外直接暴露端口 | 是 |
| `web` | 构建前端静态文件，写入 `web-dist` 共享卷后退出 | 否 |
| `caddy` | 唯一对外端口容器：静态托管 + `/api/*`、`/ws` 反代 | 是 |

路由规则：`/` → 静态文件（SPA fallback 到 `index.html`）；`/api/*` 与 `/ws` → `server:3000`。

## 2. 文件清单

```
clipnote/
├── server/Dockerfile         # 多阶段构建：node:22-alpine3.22；better-sqlite3 v13 为 N-API
│                             #   预编译二进制随包分发，构建无需任何编译工具链
├── web/Dockerfile            # 多阶段构建：产出静态文件，启动时拷入共享卷后退出
├── caddy/Caddyfile           # 静态托管 + SPA fallback + 反代 /api 与 /ws
├── docker-compose.yml        # 国际版（官方镜像源）
├── docker-compose.cn.yml     # 中国大陆专用版（镜像加速 + npmmirror + USTC apk 源）
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

server 容器内部固定 `PORT=3000`、`DATA_DIR=/data`，无需修改。

## 5. 常用运维命令

```bash
# 查看日志
docker compose logs -f server
docker compose logs -f caddy

# 更新代码后重新部署（web 重新构建后 caddy 自动拿到新静态文件）
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
docker compose exec server node -e \
  "require('better-sqlite3')('/data/clipnote.db').exec(\"VACUUM INTO '/data/backup.db'\")"
docker compose cp server:/data/backup.db ./clipnote-backup.db
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
# 基础镜像（node / alpine 统一替换）
NODE_IMAGE=docker.1ms.run/library/node:22-alpine3.22
ALPINE_IMAGE=docker.1ms.run/library/alpine:3.20
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
| 修改前端代码不生效 | 必须带 `--build` 重新构建（web 服务执行构建并刷新 `web-dist` 卷） |
| WebSocket 无法连接 | Caddyfile 已透传 `/ws` 升级请求，检查是否直连了 server 端口（应统一走对外端口） |
