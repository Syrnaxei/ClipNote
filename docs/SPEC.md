# ClipNote 项目说明书

> 版本：v1.0（2026-09-19）
> 状态：设计定稿，待开发

## 1. 项目概述

ClipNote 是一个**纯文本剪切板多设备同步服务**。用户在任何设备（桌面端脚本/工具、iOS 快捷指令、Web 界面）上将文本内容插入到某个剪切板，所有打开的设备都能**实时**看到最新内容，并可一键复制回本地剪贴板。

核心特性：

- 多个剪切板（类似文件夹），每个剪切板下多条文本条目
- 条目可新增、可编辑、可删除；**不做自动去重**，提供手动"检查重复"功能（基于内容哈希比对）
- WebSocket 实时推送，多设备秒级同步
- 单用户模式，API Key 鉴权
- Docker Compose 一键部署，外部通过 `IP:端口` 访问

### 1.1 非目标（明确不做）

- 不支持图片/文件等富媒体类型（仅文本）
- 不支持多用户/注册登录
- 不做条目分页
- 不做自动去重与自动置顶（重复检查为用户手动触发）
- 不做数据量上限与自动清理（数据永久保留）

## 2. 总体架构

```
                    ┌─────────────────────────────────────────┐
                    │           Docker Compose (服务器)        │
                    │                                         │
 桌面端脚本 ────────►│  ┌───────────────────────────────────┐  │
 iOS 快捷指令 ──────►│  │  app (Node.js, 单容器)             │  │
 (HTTP + API Key)   │  │  Express + ws + better-sqlite3    │  │
                    │  │  :3000                            │  │
 浏览器 ◄───────────►│  │  静态文件（SPA）/ api / ws          │  │
 (Web UI)           │  └────────────────┬──────────────────┘  │
                    │            ┌──────▼──────┐               │
                    │            │ SQLite 卷    │               │
                    │            │ (WAL 模式)   │               │
                    │            └─────────────┘               │
                    └─────────────────────────────────────────┘
```

单容器：

| 容器 | 职责 | 说明 |
|------|------|------|
| `app` | 静态文件（SPA）+ REST API + WebSocket + SQLite | Express 用 `express.static` 托管前端构建产物（挂载于鉴权之前），`/api` 与 `/ws` 走鉴权；对外暴露唯一端口。构建期由多阶段 Dockerfile 先行产出前端产物（Vite）再并入镜像 `/app/public` |

路由规则：

- `/` → 静态文件（SPA fallback 到 `index.html`，跳过 `/api/*` 与 `/ws`）
- `/api/*` → 鉴权后进路由（Express 原生）
- `/ws` → WebSocket 升级（鉴权独立处理）

对外端口由 `docker-compose.yml` 的 `ports` 映射决定（如 `31291:3000`），外部访问方式为 `http://<服务器IP>:31291`。可选叠加 Caddy 反代扩展（`docker-compose.proxy.yml`）接入 HTTPS/域名，见 DEPLOY.md。

## 3. 技术选型

| 层 | 选型 | 理由 |
|----|------|------|
| Server 运行时 | Node.js 22 LTS | 与前端同语言；与前端统一 TypeScript（见 3.1） |
| Web 框架 | Express 5 | 生态成熟、中间件丰富，个人项目维护成本最低 |
| WebSocket | `ws` | 轻量、无依赖、与 Express 共享 HTTP server |
| 数据库 | SQLite（better-sqlite3，WAL 模式） | 单机部署零运维、事务保证、备份即拷贝文件；剪贴板写入频率低，SQLite 完全够用 |
| 前端 | React 19 + **Vite**（自 CRA 迁移） | CRA 已停止维护；Vite 构建快、配置简单 |
| 压缩 | compression | 运行时 gzip，覆盖静态与 API 响应（单容器后由应用层替代原 Caddy `encode gzip`） |
| 容器化 | Docker Compose | 多阶段构建，最终镜像精简；单容器 + 可选 Caddy 反代扩展位 |
| 可选反代 | Caddy（`docker-compose.proxy.yml`） | 平时不启用；未来 HTTPS/域名接入时叠加，TLS 模板预置于 Caddyfile |

### 3.1 语言与工程化

- Server 端使用 **TypeScript + tsx（开发）/ tsc（构建）**，与前端语言统一。
- 数据校验使用 **zod**（API 入参是系统边界，必须校验）。
- `better-sqlite3` 为同步 API，剪贴板低写入场景下无阻塞问题，且天然免于回调地狱。

## 4. 数据模型（SQLite）

```sql
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE clipboards (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT    NOT NULL,
  uuid        TEXT    NOT NULL UNIQUE,   -- 剪切板对外标识，供外部脚本/快捷指令经 API 引用
  pinned      INTEGER NOT NULL DEFAULT 0, -- 手动置顶标记：1 置顶，0 普通
  created_at  TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE clipboard_items (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  clipboard_id INTEGER NOT NULL REFERENCES clipboards(id) ON DELETE CASCADE,
  content      TEXT    NOT NULL,
  content_hash TEXT    NOT NULL,  -- SHA-256 hex(content)，用于手动"检查重复"功能
  original_content TEXT,           -- 插件覆盖前的原文备份（单步撤销用），未备份时为 NULL
  created_at   TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE plugins (
  slug        TEXT    PRIMARY KEY,     -- 插件唯一标识（.CVT 元数据 id，slug 格式），相同 id 导入即更新
  name        TEXT    NOT NULL,        -- 展示名，允许重名
  author      TEXT    NOT NULL,
  version     TEXT    NOT NULL,        -- x.y.z
  description TEXT    NOT NULL,
  github_url  TEXT,                    -- 作者 GitHub 主页（可空），用于头像与跳转链接
  code        TEXT    NOT NULL,        -- 插件 JS 代码（process(input) 函数）
  enabled     INTEGER NOT NULL DEFAULT 0, -- 单选启用：同一时间至多一个为 1
  created_at  TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

-- 重复检查分组 + 列表排序
CREATE INDEX idx_items_clipboard_time ON clipboard_items(clipboard_id, created_at DESC);
CREATE INDEX idx_items_hash ON clipboard_items(clipboard_id, content_hash);
```

设计要点：

- **剪切板 UUID**：创建时由服务端生成（UUIDv4），全局唯一且可通过 Web 端"编辑剪切板"弹窗修改。外部脚本/快捷指令可先经 `GET /api/clipboards/by-uuid/:uuid` 解析出数字 `id` 再调用条目接口，避免 UI 与 API 之间数字 id 不一致的问题。
- **置顶**：`pinned` 由用户在 Web 端手动切换（非自动置顶）；剪切板列表按 `pinned DESC, created_at ASC` 排序，置顶的剪切板固定显示在侧边栏顶部。
- **文本存储**：`content` 用 SQLite `TEXT` 类型，UTF-8 编码，对内容长度不做应用层假设（SQLite 单值上限 1GB，远超需求）。
- **内容哈希**：条目写入与编辑时均计算 SHA-256 并存储，供"检查重复"端点高效比对（同哈希即视为内容完全相同）；不做任何自动去重/置顶行为。
- **重复检查**：`GET /api/clipboards/:id/duplicates` 按 `content_hash` 分组，返回条目数 > 1 的组，供前端"检查重复"按钮调用。
- **排序**：接口按 `created_at DESC`（最新在前）返回；Web 端渲染为时间正序（最旧在上、最新在下），新条目追加到列表末尾并贴着输入框生长。
- **时间戳**：统一 UTC ISO-8601 字符串，由数据库默认值生成，前端本地化显示。
- **备份**：数据文件挂载在 docker volume，备份用 `VACUUM INTO` 或直接停机拷贝。

## 5. API 设计

### 5.1 鉴权

- 单用户模式，部署时通过环境变量配置一个 API Key（`API_KEY`，要求足够长的随机串）。
- 所有 `/api/*` 请求携带请求头：`Authorization: Bearer <API_KEY>`。
- WebSocket 建立连接时通过 `Authorization` 头携带同一 Key（浏览器侧无法自定义 WS 头时，允许 `?key=` 查询参数作为后备，服务端对两种方式均校验）。
- 校验失败返回 `401`；Key 不做用户区分，泄露时通过更换环境变量整体轮换。

### 5.2 REST 端点

统一前缀 `/api`，响应为 JSON。约定：`created_at`/`updated_at` 均为 ISO-8601 UTC。

**剪切板**

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/clipboards` | 列出所有剪切板（含 `uuid`、`pinned`、条目数与最新条目时间，按置顶优先排序，供侧边栏展示） |
| POST | `/api/clipboards` | 新建剪切板，body: `{ "name": "string" }`；服务端自动生成 `uuid` |
| GET | `/api/clipboards/by-uuid/:uuid` | 按 UUID 查询单个剪切板（供外部脚本解析数字 `id` 用） |
| DELETE | `/api/clipboards/:id` | 删除剪切板及其全部条目（级联） |
| PATCH | `/api/clipboards/:id` | 更新剪切板，body 至少包含一项：`{ "name"?: "string", "uuid"?: "string(uuid)", "pinned"?: boolean }`；`uuid` 冲突返回 409 |

**条目**

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/items` | **独立插入 API**，body: `{ "clipboard_uuid": "string(uuid)", "content": "string", "device"?: "string", "device_type"?: "iPhone"\|"iPad"\|"Mac"\|"PC"\|"Web" }`；直接追加，不做去重（响应 `{ "item": ... }`） |
| GET | `/api/clipboards/:id/items` | 该剪切板全部条目，按 `created_at DESC` |
| PATCH | `/api/items/:id` | 编辑条目内容，body 至少一项：`{ "content"?: "string", "original_content"?: "string"\|null }`；更新 content 时重新计算哈希 |
| DELETE | `/api/items/:id` | 删除单条条目 |
| GET | `/api/clipboards/:id/duplicates` | 检查该剪切板内重复条目，返回按内容哈希分组的重复组列表（每组含组内全部条目）；无重复返回空数组 |

**插件**

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/plugins` | 列出全部插件（含代码，全设备共享；`id` 即 slug） |
| POST | `/api/plugins` | 导入插件，body: `{ "id", "name", "author", "version", "description", "github_url"?, "code", "enabled"? }`；`id` 相同即更新（upsert），允许重名；`enabled: true` 时自动禁用其他插件，默认未启用 |
| PATCH | `/api/plugins/:id` | 按 slug 更新插件（至少一项字段，`github_url` 传 `null` 清除）；`enabled: true` 为单选启用（服务端先清零其他），`enabled: false` 取消启用 |
| DELETE | `/api/plugins/:id` | 按 slug 删除插件（条目的 `original_content` 备份不受影响） |

### 5.3 插件系统

- 插件为全局通用的文本处理黑盒（`.CVT` 文件，格式见 `docs/PLUGINS.md`）：入口为条目文本，出口为处理后文本，`process(input)` 纯函数。元数据 `id`（slug）为唯一标识，重导入即更新；`github_url` 可选，填写后详情页显示 GitHub 头像与主页链接（前端直连加载，失败回退文字头像）。
- 前端 Web Worker 沙箱执行（无 DOM/网络访问，3 秒超时强杀）；异常/超时不覆盖原条目。
- **单选启用**：同一时间至多一个插件启用；主界面条目悬停显示插件按钮，点击弹「原文 / 处理结果」双栏预览确认，确认后覆盖并把原文写入 `original_content`，toast 提供单步撤销。

错误响应统一格式：

```json
{ "error": { "code": "VALIDATION_ERROR", "message": "content is required" } }
```

错误码：`VALIDATION_ERROR`(400)、`UNAUTHORIZED`(401)、`NOT_FOUND`(404)、`CONFLICT`(409，剪切板 UUID 重复)。

**独立插入 API 的说明**：`POST /api/items` 即为区别于前端的独立入口，供桌面端脚本与 iOS 快捷指令直接调用，不支持批量；目标剪切板由 body 中的 `clipboard_uuid` 指定；`device_type` 大小写不敏感，枚举外或缺失的值归一化为 `Unknown`，两字段均未传时不记录来源设备。

### 5.3 WebSocket 实时推送

- 端点 `/ws`，鉴权方式见 5.1。
- 连接后服务端**不推送历史数据**，客户端连接/重连后通过 REST 全量拉取一次（剪贴板数据量小，全量拉取最简单可靠，无需增量游标）。
- 服务端推送的消息（JSON，统一信封 `{ "type": "...", "payload": ... }`）：

| type | 触发时机 | payload |
|------|----------|---------|
| `clipboard.created` / `clipboard.updated` / `clipboard.deleted` | 剪切板新建 / 更新（重命名、改 UUID、置顶切换）/ 删除 | 剪切板对象 / `{ id }` |
| `item.created` | 条目新增 | 完整条目对象 |
| `item.updated` | 条目内容被编辑 | 完整条目对象（含新内容与哈希） |
| `item.deleted` | 条目删除 | `{ id, clipboardId }` |

- 任一客户端（Web 或外部 API）产生变更后，服务端向**所有**已连接客户端广播；连接断开的设备在下次打开/重连时通过 REST 补齐。
- 心跳：服务端每 30s 发送 ping，客户端 60s 无 pong 则断开由前端自动重连（指数退避）。

## 6. Web 前端

### 6.1 现状与迁移

现有 preview（`Preview/web/clipnote-frontend`）为 React 19 + CRA 的纯 mock 版本，UI 结构完整：

- `App.js`：持有 `clipboards` / `clipboardItems` 两份 mock state 及全部增删改逻辑
- `Sidebar`：剪切板列表 + 按名称搜索 + 新建/删除
- `ClipboardList` / `ClipboardItem`：条目列表的新增/删除/编辑/复制
- `Header`：静态头部

迁移为正式版时：

1. **CRA → Vite**：迁移 `index.html` 到根目录、入口改 `main.tsx`、替换 `react-scripts` 为 `vite` + `@vitejs/plugin-react`，保留现有组件与样式。
2. **mock 数据 → API 层**：新增 `src/api.ts` 封装 REST 调用 + `src/ws.ts` 封装 WebSocket 连接与自动重连，`App.js` 改为通过 API/WS 驱动 state（可引入 SWR 类轻量缓存，或直接 useState + effect，按最小实现）。
3. **TypeScript 化**：组件与数据结构补全类型（与 server 端共享类型定义可后续抽取，非首期必须）。
4. **交互调整**：保留条目的新增/编辑/删除/复制功能（`navigator.clipboard.writeText` 复制）；在条目列表头部增加"检查重复"按钮，调用 duplicates 端点并以高亮/分组方式展示重复条目结果。
5. **搜索**：preview 中按剪切板名称搜索保留现状；条目内容搜索不在本期范围。

### 6.2 开发体验

- Vite dev server 配置 proxy：`/api` 与 `/ws` 转发到本地 server，前端独立热更新开发。

## 7. 部署（Docker Compose）

```
clipnote/（部署构建产物,由 scripts/build.sh 组装）
├── app/                  # 唯一构建上下文（单容器）
│   ├── Dockerfile        # 多阶段:web-build（Vite）→ server-build（tsc+prune）→ 运行时合并
│   ├── server/           # server/package.json、tsconfig、src/
│   └── web/              # web/package.json、tsconfig、vite.config、index.html、src/、public/
├── caddy/
│   └── Caddyfile         # 仅 proxy 扩展使用:默认 :80 纯反代,顶部含 TLS 启用模板
├── docker-compose.yml
├── docker-compose.cn.yml
├── docker-compose.proxy.yml   # 可选反代扩展 overlay
└── docs/SPEC.md
```

`docker-compose.yml` 关键点：

- `app`：单容器，唯一服务。环境变量 `API_KEY`（必填）、`PORT`、`DATA_DIR`、`PUBLIC_DIR`；`ports` 暴露 `${CLIPNOTE_PORT:-31291}:3000`；volume 挂载数据目录（SQLite 文件）。
- 前端构建产物在镜像构建期（web-build stage）产出，运行时位于容器内 `/app/public`，由 Express `express.static` 托管（挂载于鉴权中间件之前，静态匿名可达；SPA fallback 跳过 `/api/*` 与 `/ws`）。
- 数据持久化：named volume `clipnote-data` → `/data`（SQLite 数据库文件所在）。
- 无 HTTPS（外部经 `IP:端口` 明文访问；需要 TLS 时叠加 `docker-compose.proxy.yml`，见 DEPLOY.md）。

## 8. 安全要点

- API Key 部署时生成（如 `openssl rand -hex 32`），仅存于 `.env`（不入库、不提交）。
- 插入 API 对 `content` 做 zod 校验：必须为 string、非空、上限设 1MB（防御性上限，防误传大文本拖垮内存）。
- SQLite 全程参数化查询，杜绝注入。
- 前端渲染条目内容时 React 默认转义，无 XSS 风险；不使用 `dangerouslySetInnerHTML`。
- 静态文件经 `express.static` 匿名托管（挂载于鉴权之前），仅 `dist` 目录内容可达，无目录列举；`/api` 与 `/ws` 全部经 Bearer API Key 鉴权。
- server 端 CORS 不放开（同源部署 + 外部脚本直连 `/api` 不受 CORS 影响，因为非浏览器请求无 CORS 限制）。
- 可选 Caddy 反代仅透传请求（`reverse_proxy`），不注入额外头。

## 9. 里程碑开发计划

| 里程碑 | 内容 | 验收标准 |
|--------|------|----------|
| **M1 Server 核心** | 项目骨架（TS + Express + zod）、SQLite 建表与 WAL、剪切板 CRUD、条目增/删/改、重复检查端点、API Key 鉴权中间件 | curl 可完成全部 REST 流程；duplicates 端点能正确返回重复分组 |
| **M2 实时推送** | `ws` 集成、鉴权、心跳与断连清理、六类事件广播 | 两个终端各开一条 WS 连接，一端 curl 插入条目，另一端秒级收到 `item.created` |
| **M3 前端接入** | CRA→Vite 迁移、TypeScript 化、API 层与 WS 层封装、对接全部交互（含条目编辑与"检查重复"按钮） | 浏览器操作与 curl 插入双向实时同步；断网重连后数据自动补齐；检查重复可正确高亮重复条目 |
| **M4 容器化部署** | 单容器 Dockerfile（app：web-build + server-build 多阶段）、docker-compose（含 .cn 与可选 .proxy 扩展）、.env 示例与 README 部署说明 | 服务器上 `docker compose up -d` 后，外部 `IP:端口` 可正常使用全部功能 |
| **M5（可选增强）** | FTS5 条目内容搜索、桌面端/快捷指令对接示例脚本、`VACUUM INTO` 定时备份脚本 | —— |

里程碑依赖关系：M1 → M2 → M3 → M4，M5 独立可随时插入。

## 10. 关键决策记录

| 决策 | 结论 | 原因 |
|------|------|------|
| 存储 | SQLite (WAL) | 单机 compose 部署零运维；PostgreSQL 对此规模过度设计，纯文件系统无事务无索引 |
| 同步 | WebSocket 广播 + REST 全量拉取兜底 | 体验最接近原生剪贴板；全量拉取避免增量同步的游标/冲突复杂度 |
| 条目语义 | 可增/删/改 + 手动检查重复 | 对齐 preview 既有交互；不做自动去重，重复检查由用户按需触发，基于存储的内容哈希分组实现 |
| 鉴权 | 单用户 + API Key | 防公网裸奔的最小成本方案；多用户需求出现前不做 |
| 前端 | CRA → Vite | CRA 已停止维护，迁移成本低且一次性完成 |
| 反代 | Caddy 降级为可选扩展位（2026-10-25 单容器合并） | 单容器自持后反代仅在未来 HTTPS/域名接入时需要；扩展位预写 TLS 模板，启用即用 |
