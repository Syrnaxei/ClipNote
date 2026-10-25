<h1 align="center">ClipNote</h1>

<p align="center">
  剪记 -- 随时随地记录重要信息
</p>

<p align="center">
  <a href="#部署">部署</a> ·
  <a href="#核心功能">核心功能</a> ·
  <a href="docs/SPEC.md">项目说明书</a>
</p>

<p align="center">
  <img src="assets/ClipNote-mainpic.png" alt="ClipNote" width="720" />
</p>

---

## 简介

ClipNote 让你在任意设备（桌面脚本、iOS 快捷指令、浏览器）上把一段文本存入剪贴板，其余所有设备**实时**看到最新内容，并可一键复制回本地。它面向个人跨设备文本流转场景，开箱即用、零运维。

> 原名 ClipVault，2026-10 更名为 ClipNote。旧数据（数据库文件、Docker 卷、浏览器设置）在升级时自动迁移，详见 [docs/DEPLOY.md](docs/DEPLOY.md) 第 7 节。

## 核心功能

- **多剪贴板**：像文件夹一样管理多个剪贴板。
- **实时同步**：多设备同步，断线自动重连并补齐期间缺失的数据。
- **条目管理**：新增、编辑、删除、复制，并可手动「检查重复」（按内容哈希分组）。
- **设备来源标记**：每条记录标注来源设备（iPhone / iPad / Mac / PC / Web），设备名可自定义。
- **插件扩展**：通过 `.CVT` 文字处理插件对剪贴板内容做自动化加工，处理结果可预览、可撤销。
- **安全鉴权**：所有接口与实时连接均需 API Key 校验，保障私有部署的数据安全。

## APPLE 设备接入

在 Web 端输入 API Key 即可直接使用。桌面脚本与 iOS 快捷指令通过标准 HTTP 接口写入文本，携带 `Authorization: Bearer <API_KEY>` 请求头即可，剪贴板 UUID 在 Web 端「编辑剪贴板」弹窗中查看。

iOS / iPadOS / macOS 用户可直接获取快捷指令，一键把剪切板内容写入 ClipNote：

<a href="https://www.icloud.com/shortcuts/99a3eb2586d04c1e9283fe5273534bc4">
  <img src="assets/badge-dark.svg" alt="获取 Apple 快捷指令" height="36" />
</a>

完整 REST 端点、WebSocket 事件与错误码见 [docs/SPEC.md](docs/SPEC.md)。

## 插件系统

本项目的核心卖点，插件是 `.CVT` 纯文本文件，包含一段元数据与一个处理函数，经「插件管理」界面导入后存储在服务器，供所有设备共享。插件在浏览器沙箱中安全执行，处理结果提供「原文 / 结果」预览并支持单步撤销，同一时间启用一个插件。

规范详见 [docs/PLUGINS.md](docs/PLUGINS.md)，示例插件见 [extensions/](extensions/)。

## 部署

前置要求：Docker Engine 20.10+（使用 docker compose 方式还需 Docker Compose v2，`docker compose version` 可查）。

已发布的多架构镜像（`linux/amd64` + `linux/arm64`）托管于 GHCR：

```
ghcr.io/syrnaxei/clipnote
```

tag 规则：`latest`（最新发布）、`1.5`（主.次版本）、`1.5.0`（精确版本）。

### 方式一：docker run（一条命令启动）

```bash
docker run -d --name clipnote \
  -p 31291:3000 \
  -e API_KEY=$(openssl rand -hex 32) \
  -v clipnote-data:/data \
  --restart unless-stopped \
  ghcr.io/syrnaxei/clipnote:latest
```

- `-e API_KEY=...`：API 鉴权 Key，**请换成你自己的强随机值**（`openssl rand -hex 32` 生成），登录 Web 端时输入。
- `-p 31291:3000`：对外端口。
- `-v clipnote-data:/data`：数据卷，所有剪贴板数据存在这里。

### 方式二：docker compose（推荐，便于维护升级）

新建一个目录，放入 `docker-compose.yml`：

```yaml
services:
  app:
    image: ghcr.io/syrnaxei/clipnote:latest
    ports:
      - "${CLIPNOTE_PORT:-31291}:3000"
    environment:
      API_KEY: ${API_KEY:?API_KEY is required - set it in .env}
    volumes:
      - clipnote-data:/data
    restart: unless-stopped

volumes:
  clipnote-data:
```

同目录生成 `.env` 并启动：

```bash
echo "API_KEY=$(openssl rand -hex 32)" > .env
docker compose up -d
```

之后升级只需：

```bash
docker compose pull && docker compose up -d
# 数据在 clipnote-data 卷中，升级不受影响
```

### 方式三：从源码构建

```bash
git clone https://github.com/Syrnaxei/ClipNote.git clipnote
cd clipnote/docker
cp .env.example .env      # 编辑 .env，设置强随机 API_KEY
docker compose up -d --build
# 中国大陆服务器使用专用版（走国内镜像源）：
# docker compose -f docker-compose.cn.yml up -d --build
```

### 验证

浏览器打开 `http://<服务器IP>:31291`，输入 API Key 即可使用。命令行验证：

```bash
curl -H "Authorization: Bearer <你的API_KEY>" http://localhost:31291/api/clipboards
```

> - GHCR 在中国大陆直连不稳定，拉取失败时可配置 Docker 代理或改用方式三（中国版 compose）。
> - 数据备份、恢复、HTTPS/域名接入与从旧版迁移，见 [docs/DEPLOY.md](docs/DEPLOY.md)。

## 技术架构

采用单容器架构：Node.js 服务（Express 5）自持静态文件托管（SPA）+ `/api` + `/ws`，数据落 SQLite（WAL 模式），通过 Docker Compose 多阶段构建一键部署。可选叠加 Caddy 反代扩展位以接入 HTTPS/域名（见 docs/DEPLOY.md）。

```
 桌面端脚本 ────────►  app (Node.js, 单容器)
 iOS 快捷指令 ──────►  :3000  Express + ws + better-sqlite3
 浏览器 ◄──────────►  静态文件（SPA）   │
                                     SQLite 卷（WAL 模式）
```

| 层 | 技术 |
|----|------|
| Server | Node.js 22 + TypeScript + Express 5 + ws + better-sqlite3 + zod + compression |
| Web | React 19 + Vite + TypeScript（构建产物由 server 托管） |
| 部署 | Docker 多阶段构建，单容器，镜像发布至 GHCR |
| 可选反代 | Caddy 扩展位（`docker-compose.proxy.yml`，HTTPS/域名接入） |

本地开发一键启动前后端环境：

```bash
./scripts/dev.sh   # 详见 docs/DEV.md
```

## 文档

- [docs/SPEC.md](docs/SPEC.md) — 项目说明书（架构 / 数据模型 / API / 决策记录）
- [docs/DEPLOY.md](docs/DEPLOY.md) — 部署、备份、升级与迁移
- [docs/PLUGINS.md](docs/PLUGINS.md) — 插件规范（.CVT）
- [docs/DEV.md](docs/DEV.md) — 本地开发指南
- [docs/DESIGN.md](docs/DESIGN.md) — 前端设计系统

## License

[MIT](LICENSE)
