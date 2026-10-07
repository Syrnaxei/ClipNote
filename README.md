# ClipNote

纯文本剪切板多设备同步服务。在任何设备（桌面端脚本、iOS 快捷指令、浏览器）上把文本插入某个剪切板，所有设备**实时**看到最新内容，并可一键复制回本地剪贴板。

> 原名 ClipVault，2026-10 更名为 ClipNote。旧数据（数据库文件、Docker 卷、浏览器设置）升级时自动迁移，详见 [docs/DEPLOY.md](docs/DEPLOY.md) 第 7 节。

## 特性

- **多剪切板**：类似文件夹的多个剪切板，支持置顶、重命名、UUID 引用
- **实时同步**：WebSocket 推送，多设备秒级同步；断线自动重连并补齐数据
- **条目管理**：新增 / 编辑 / 删除 / 复制，手动"检查重复"（基于 SHA-256 内容哈希分组）
- **设备来源标记**：条目记录来源设备（iPhone / iPad / Mac / PC / Web），自定义设备名
- **插件系统**：`.CVT` 文字处理插件，前端 Web Worker 沙箱执行（3 秒超时），处理结果带"原文/结果"预览与单步撤销；同一时间单插件启用
- **单用户 API Key 鉴权**：所有 `/api` 与 `/ws` 请求校验 `Authorization: Bearer <API_KEY>`
- **Docker Compose 一键部署**：Caddy（静态托管 + 反代）+ Node.js server + SQLite（WAL），零运维

## 架构

```
 桌面端脚本 ────────►  Caddy  ────►  server (Node.js)
 iOS 快捷指令 ──────►  :80         Express + ws + better-sqlite3
 浏览器 ◄──────────►  静态文件      │
                                 SQLite 卷（WAL 模式）
```

| 层 | 技术 |
|----|------|
| Server | Node.js 22 + TypeScript + Express 5 + ws + better-sqlite3 + zod |
| Web | React 19 + Vite + TypeScript |
| 代理 | Caddy（静态托管 + `/api/*`、`/ws` 反代） |
| 部署 | Docker Compose 多阶段构建 |

## 快速部署

前置要求：Docker Engine 20.10+ 与 Docker Compose v2。

```bash
cp .env.example .env
# 编辑 .env：设置强随机 API_KEY（openssl rand -hex 32）
# 对外端口默认 31291，可用 CLIPNOTE_PORT 修改

docker compose up -d --build
# 中国大陆服务器使用专用版：
# docker compose -f docker-compose.cn.yml up -d --build
```

浏览器打开 `http://<服务器IP>:31291`，输入 API Key 即可使用。

数据备份、恢复、升级与常见问题见 [docs/DEPLOY.md](docs/DEPLOY.md)。

## 外部设备接入

所有请求携带请求头 `Authorization: Bearer <API_KEY>`。

**插入文本**（桌面脚本 / iOS 快捷指令通用）：

```bash
curl -X POST http://<服务器IP>:31291/api/items \
  -H "Authorization: Bearer <API_KEY>" \
  -H "Content-Type: application/json" \
  -d '{"clipboard_uuid": "<剪切板UUID>", "content": "要同步的文本", "device": "我的iPhone", "device_type": "iPhone"}'
```

剪切板 UUID 可在 Web 端"编辑剪切板"弹窗查看；查询接口 `GET /api/clipboards/by-uuid/:uuid`。

完整 REST 端点、WebSocket 事件与错误码见 [docs/SPEC.md](docs/SPEC.md)。

## 插件系统

插件是 `.CVT` 纯文本文件：头部 `/* ClipNote-Plugin { …JSON 元数据… } */` + 一个 `process(input)` 纯函数，经「插件管理」界面导入，存储在服务器供所有设备共享，处理结果可预览、可撤销。

```text
/* ClipNote-Plugin
{ "id": "trim-whitespace", "name": "去除首尾空白", "author": "you",
  "version": "1.0.0", "description": "移除首尾空白字符" }
*/
function process(input) {
  return input.trim();
}
```

规范详见 [docs/PLUGINS.md](docs/PLUGINS.md)，示例插件见 [extensions/](extensions/)（旧标记 `ClipVault-Plugin` 仍兼容）。

## 本地开发

```bash
# 一键启动前后端开发环境（详见 docs/DEV.md）
./scripts/dev.sh

# 或分开跑：
cd server && npm run dev     # tsx watch，默认 :3000
cd web && npm run dev        # Vite，/api 与 /ws 代理到 server
```

开发区 → 部署区文件同步流程见部署区 `docs/UPDATE.md`。

## 文档

- [docs/SPEC.md](docs/SPEC.md) — 项目说明书（架构 / 数据模型 / API / 决策记录）
- [docs/DEPLOY.md](docs/DEPLOY.md) — 部署、备份、升级与迁移
- [docs/PLUGINS.md](docs/PLUGINS.md) — 插件规范（.CVT）
- [docs/DEV.md](docs/DEV.md) — 本地开发指南
- [docs/DESIGN.md](docs/DESIGN.md) — 前端设计系统

## License

MIT
