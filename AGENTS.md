# AGENTS.md

本文件是 ClipNote 仓库的协作契约，面向所有在此仓库工作的 AI Agent 与协作者。开工前请先读完本文件；涉及具体模块时，再阅读对应的 `docs/` 文档。

## 1. 项目概览

ClipNote（剪记）是一个**纯文本剪切板多设备同步服务**：任意设备（桌面脚本、iOS 快捷指令、浏览器）把文本写入某个剪切板，其他设备通过 WebSocket 实时看到最新内容，并可一键复制回本地。单用户、单 API Key、自部署。

- **Server**：Node.js + TypeScript + Express 5 + `ws` + better-sqlite3（WAL 模式）+ zod
- **Web**：React 19 + Vite + TypeScript
- **部署**：单容器。Express 同时托管 SPA 静态文件、`/api` 与 `/ws`；镜像发布到 `ghcr.io/syrnaxei/clipnote`
- **本地端口**：server `3000`，web `5173`（Vite 代理 `/api`、`/ws` 到 3000）

明确不做（除非规格变更）：图片/文件等富媒体、多用户与注册登录、条目分页、自动去重与自动置顶、数据量上限与自动清理。

## 2. 开工前必读

按任务类型选择阅读顺序，不要凭猜测改代码：

| 任务 | 必读 |
|------|------|
| 任何任务 | 本文件、`CONTEXT.md`（术语表） |
| 改 API / 数据模型 / 架构 | `docs/SPEC.md` |
| 改插件系统 | `docs/PLUGINS.md`、`docs/adr/0003-工具栏插件迁入Worker沙箱与能力桥.md` |
| 改前端视觉 / 交互 | `docs/DESIGN.md`、`CONTEXT.md` 中的移动端术语 |
| 改部署 / 构建 / CI | `docs/DEPLOY.md`、`Dockerfile`、`.github/workflows/release.yml` |
| 大功能或不可逆决策 | 先看 `docs/specs/` 与 `docs/adr/` 是否已有结论 |

`docs/adr/0002` 已被 `0003` 取代，不要按 0002 恢复主线程执行插件。

## 3. 技术栈与运行形态

| 层 | 技术 |
|----|------|
| Server | Node.js 22+、TypeScript（strict，ESM + NodeNext）、Express 5、ws、better-sqlite3、zod、compression |
| Web | React 19、Vite 7、TypeScript（strict） |
| 测试 | Web 端 Vitest（纯逻辑模块）；Server 端暂无测试，靠 typecheck + curl 验证 |
| 容器 | 根目录 `Dockerfile` 多阶段构建：web-build → server-build → 运行时；`linux/amd64` + `linux/arm64` |
| 发布 | 推送 `v*` tag → GitHub Actions 构建多架构镜像并创建 Release |

本地开发机当前 Node v24 也可用；生产镜像固定 Node 22。

## 4. 仓库地图

```
server/src/           Express 入口、鉴权、配置、DB、WS、路由、zod 校验、错误处理
web/src/              React 应用；components/ 组件与同名 CSS；plugins/ 解析、Worker 沙箱、能力桥
docs/                 SPEC / CONTEXT / PLUGINS / DESIGN / DEV / DEPLOY / adr / specs / review
scripts/dev.sh        一键安装缺失依赖并启动前后端
Dockerfile            根目录单容器多阶段构建（构建上下文 = 仓库根目录）
.github/workflows/    release.yml：v* tag → 多架构镜像 + GitHub Release
assets/               README 图片与徽章
```

以下目录/文件被 `.gitignore` 忽略，不要提交其内容：`node_modules/`、`dist/`、`preview/`、`extensions/`、`docker/`、`server/data/`、`.env`、`*.db*`、`.DS_Store`、`.scratch/`、`.claude/`。若确实需要把其中某项入库，先与维护者确认。

## 5. 分支策略

| 分支 | 角色 |
|------|------|
| `main` | 发布分支。始终可部署、可打 tag；只接受来自 `dev` 的合并 |
| `dev` | 开发集成分支。所有功能、修复、文档、杂务提交都在这里 |

规则：

1. **所有开发与修改都在 `dev` 上完成**，禁止直接向 `main` 提交。
2. 开工先确认分支：`git branch --show-current`。若不在 `dev`，切换到 `dev`；本地没有时用 `git switch -c dev --track origin/dev`。
3. **只有功能测试完全通过**（自动检查 + 必要的人工验证）才允许合并到 `main`。
4. 合并 `main`、打 tag、改版本号、push 均由维护者手动执行，Agent 不得自行操作（见第 12 节）。
5. 当前无需额外 feature 分支；除非维护者明确要求，改动直接提交在 `dev`。

## 6. Git commit 政策

**核心原则：每完成一组改动就提交，不要攒批；小而可审查的提交是常态。**

格式：

```
type(scope): 中文描述
```

- `type` 用英文：`feat`、`fix`、`docs`、`chore`、`refactor`、`style`、`test`、`perf`、`ci`、`build`
- `scope` 可选，用英文小写：`web`、`server`、`api`、`ui`、`plugins`、`deploy`、`spec`、`ci`、`version` 等
- 冒号后使用**中文描述**，与仓库现有历史保持一致
- 描述聚焦「做了什么」，需要解释「为什么」时在 body 中说明

示例：

```
chore: 初始化工作区
docs: 定义仓库协作契约
feat(web): 新增媒体库外壳
feat(api): 新增健康检查与任务路由
fix(worker): 稳定队列启动
docs(deploy): 重构部署说明并更新镜像发布信息
```

要求：

- 一组逻辑改动一个 commit；不要把无关修改、格式化、重构混进功能提交
- 每个 commit 应通过对应端的 typecheck；不要提交明显损坏的中间状态
- 不提交生成物、运行数据、密钥（见第 4 节与第 10 节）
- 不修改已推送的历史（不 amend 已发布 commit、不强推）
- 不使用 `--no-verify` 跳过 hooks
- **本地 commit 后不要 push**，除非维护者明确要求

## 7. 提交前验证

按改动范围执行，并在交付说明中列出实际跑过的命令与结果：

| 改动范围 | 必须执行 |
|----------|----------|
| 仅文档 | 检查命令、路径、链接与当前代码一致 |
| `web/` 逻辑或组件 | `cd web && npm test`；`cd web && npx tsc -b` |
| `web/` UI / 交互 | 上述检查 + 浏览器实测（`bash scripts/dev.sh`） |
| `server/` | `cd server && npm run typecheck`；行为变更加 curl 验证（参考 `docs/DEV.md`） |
| 插件系统 | `cd web && npm test`（覆盖解析、正则匹配、能力桥）+ 按 `docs/PLUGINS.md` 4.5 手工验收 |
| 构建 / 依赖 / Dockerfile / CI | 两端构建 + `npm ci --dry-run --prefix web` / `--prefix server` 检查 lockfile 同步 |
| 每次 commit 前 | **两端 typecheck 都跑一遍**：`cd server && npm run typecheck`，`cd web && npx tsc -b` |

补充：

- 仓库没有 lint 脚本，遵循现有代码风格即可
- Web 测试只覆盖纯逻辑模块（`itemsOrder`、`longPress`、`mobileDetect`、`plugins/*`），没有组件/DOM 测试；改动 `App.tsx` 等核心 UI 时必须人工验证
- 如果无法完成浏览器实测，必须在交付说明中明确写出「未验证」及其原因，不得声称已通过 UI 验证

## 8. 本地开发与常用命令

```bash
# 一键启动（推荐；自动安装缺失依赖，读取根目录 .env 中的 API_KEY）
bash scripts/dev.sh

# 分别启动
cd server && API_KEY=<密钥> npm run dev     # tsx watch，端口 3000
cd web && npm run dev                       # Vite，端口 5173

# 构建与检查
cd server && npm run typecheck              # tsc --noEmit
cd server && npm run build                  # 输出 dist/
cd web && npm test                          # vitest run
cd web && npx tsc -b                        # 类型检查（tsconfig 已 noEmit）
cd web && npm run build                     # tsc -b + vite build
```

环境变量（server）：`API_KEY` 必填；`PORT` 默认 3000；`DATA_DIR` 默认 `./data`；`PUBLIC_DIR` 默认 `./public`。

## 9. 代码约定

### 通用

- TypeScript 两端均为 `strict`；保持类型完整，不用 `any` 绕过问题
- 代码注释与文档使用中文，标识符使用英文
- 2 空格缩进、单引号、语句带分号，沿用现有文件风格
- 最小改动：不做任务之外的顺手重构、格式化或抽象
- 新增运行时依赖前先说明理由；能用现有依赖与浏览器 API 解决就不要引入新包

### Server

- ESM + NodeNext：**相对导入必须带 `.js` 扩展名**（如 `import { auth } from './auth.js'`），即使源文件是 `.ts`
- 所有外部输入在 `server/src/validation.ts` 用 zod 校验；内容上限 1MB
- 错误响应统一为 `{ "error": { "code": "...", "message": "..." } }`，错误码见 `docs/SPEC.md`
- SQLite 全程参数化查询；数据库结构与迁移在 `server/src/db.ts`
- 不新增 CORS；同源部署是既定设计
- 变更 API 字段/响应/WS 事件时，同步 `web/src/types.ts`、`web/src/ws.ts` 与 `docs/SPEC.md`

### Web

- API 调用集中在 `web/src/api.ts`，WebSocket 逻辑在 `web/src/ws.ts`
- 组件与其 CSS 同名同目录（如 `Sidebar.tsx` + `Sidebar.css`），不引入 UI 框架
- 可测试的纯逻辑抽成独立模块并配 `.test.ts`
- localStorage 键统一 `clipnote_*` 前缀；重命名键时使用 `web/src/storage.ts` 的 `migrateStorageKey`
- 移动端判定遵循 `CONTEXT.md`：`pointer: coarse` + `maxTouchPoints` + UA 综合判定，结果写根节点 class；**不要用视口宽度判断**
- 视觉遵循 `docs/DESIGN.md` 的颜色、间距、圆角与动效规范

### 已知坑

- `web/vite.config.js` 与 `web/vite.config.ts` 同时存在，Vite 优先读取 `.js`。修改代理或插件配置时**必须同步两个文件**，否则改了 `.ts` 不生效
- 静态托管与 SPA fallback 被有意放在鉴权中间件之前，只有 `/api` 与 `/ws` 走鉴权；不要调整这个顺序
- `server/data/`、`web/dist/`、根目录 `dist/` 是本地运行产物，不要提交
- `docs/review/代码高危审计.md` 是历史快照，修复状态以当前代码为准，不要当作实时契约

## 10. 安全红线

- 不记录、不提交、不写入文档任何真实 `API_KEY`；`.env` 仅本地使用
- 不得削弱鉴权：所有 `/api/*` 与 `/ws` 必须经过 API Key 校验；不要放开 CORS
- 所有 API 入参必须经 zod 校验；SQL 只用参数化查询
- 前端不使用 `dangerouslySetInnerHTML`，依赖 React 默认转义
- 插件执行模型不可回退：
  - 文本处理插件与工具栏插件都在 **Web Worker** 中执行，宿主超时 3 秒
  - 工具栏插件的特权操作只能经**能力桥**（`clipnote.open/copy/storage/systemNotify`）由主线程校验后代执行
  - `clipnote.open` 仅放行 `http/https`，并带 `noopener`
  - 不要恢复主线程 `new Function` 直接执行，也不要重新引入「安装即信任」机制来替代沙箱
  - Worker 内**保留原生网络能力**（fetch/XHR/importScripts），文档必须如实说明，禁止宣称「沙箱内不能联网」
- 插件契约以 `docs/PLUGINS.md` 为准；改插件行为时同步更新规范与示例
- 新增对外端口、服务或改变部署拓扑前，先更新 `docs/SPEC.md` 与 `docs/DEPLOY.md`

## 11. 文档体系

| 文档 | 作用 | 何时更新 |
|------|------|----------|
| `docs/SPEC.md` | 项目说明书：架构、数据模型、API、WS、安全 | API/模型/架构/部署拓扑变化 |
| `CONTEXT.md` | 领域术语表 | 引入新术语或调整既有术语含义 |
| `docs/PLUGINS.md` | `.CVT` 插件规范与能力边界 | 插件格式、契约、能力变化 |
| `docs/DESIGN.md` | 前端设计系统 | 视觉规范或组件样式变化 |
| `docs/DEV.md` | 本地开发指南 | 启动方式、端口、命令变化 |
| `docs/DEPLOY.md` | 部署、备份、升级、迁移 | 镜像、compose、环境变量变化 |
| `docs/adr/000N-名称.md` | 不可逆决策记录 | 做架构决策时新增；用新 ADR 取代旧结论 |
| `docs/specs/YYYY-MM-DD-名称.md` | 功能规格 | 大功能开工前的设计说明 |
| `README.md` | 用户向介绍与快速部署 | 功能、部署方式、镜像信息变化 |

规则：

- 代码与相关文档在**同一个 commit** 内更新，避免文档滞后
- 文档描述必须与实现一致；禁止把未实现的安全边界写成既成事实
- ADR 一旦接受不回头改写结论；被取代时在旧文件标注状态，新建 ADR 说明原因

## 12. 版本与发布（维护者手动执行）

Agent **不得**自行执行以下操作，只能在准备就绪时向维护者报告：

1. 将 `dev` 合并到 `main`（前提：功能测试完全通过）
2. 修改版本号
3. 创建/推送 tag
4. 推送到任何远端

维护者发版流程：

1. 同步并合并 `dev` → `main`
2. 更新版本号（**4 处**）：`server/package.json`、`server/package-lock.json`、`web/package.json`、`web/package-lock.json`
3. 提交：`chore: 升级版本至 x.y.z`
4. 在 `main` 上打 tag `vX.Y.Z` 并推送
5. CI 会校验 lockfile 同步（`npm ci --dry-run`），构建 `linux/amd64` + `linux/arm64` 镜像并推送 GHCR，同时创建 GitHub Release

镜像 tag 规则：`latest`、`X.Y`、`X.Y.Z`。

## 13. Agent 行为准则

1. **先理解再动手**：读第 2 节列出的相关文档与现有实现，确认根因/需求后再改
2. **只做被要求的事**：最小 diff，不顺手重构、不扩大范围、不添加未要求的功能
3. **分支纪律**：所有提交落在 `dev`；提交前确认当前分支，若在 `main` 立即停下并切换
4. **小步提交**：每组可审查的改动完成后立即 commit，不攒批
5. **验证后再说完成**：跑完第 7 节要求的检查；UI 改动尽量在浏览器实测，做不到就明确说明未验证
6. **不碰共享与危险操作**：不 push、不合并、不打 tag、不改版本；不执行 `git reset --hard`、`git checkout --`、`git clean -f`、强推等可能丢失工作的命令；发现意外文件或未提交改动先调查，不要直接覆盖
7. **删除与覆盖要克制**：只删任务点名的内容；不确定时先询问或改用可逆操作
8. **依赖与配置变更要说明**：新增依赖、修改构建/CI/环境变量时，在提交信息或交付说明中解释原因
9. **交付说明简洁**：列出改了什么、验证命令与结果、未验证项、下一步；不要复述完整 diff
