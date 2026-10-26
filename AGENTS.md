# AGENTS.md

ClipNote 仓库的协作契约。开工前读完；涉及具体模块时再读对应 `docs/`。文档与代码不一致时，以代码和 `docs/SPEC.md` 为准并同步修正。

## 1. 项目与架构

ClipNote（剪记）是**纯文本剪切板多设备同步服务**：任意设备写入文本，其他设备经 WebSocket 实时看到并可一键复制。单用户、单 API Key、自部署。

- Server：Node.js 22+、TypeScript（strict，ESM/NodeNext）、Express 5、`ws`、better-sqlite3（WAL）、zod、compression
- Web：React 19、Vite 7、TypeScript（strict）；测试用 Vitest
- 部署：单容器，Express 同时托管 SPA 静态文件、`/api`、`/ws`；镜像发布到 `ghcr.io/syrnaxei/clipnote`
- 本地端口：server 3000，web 5173（Vite 代理 `/api`、`/ws`）

不做（除非规格变更）：富媒体、多用户/登录、分页、自动去重/置顶、数据量上限与自动清理。

## 2. 开工前必读

- 所有任务：`CONTEXT.md`
- API/数据模型/架构：`docs/SPEC.md`
- 插件：`docs/PLUGINS.md`、`docs/adr/0003-*`（`0002` 已被取代，勿按 0002 恢复主线程执行）
- 前端视觉：`docs/DESIGN.md`
- 部署/CI：`docs/DEPLOY.md`、`Dockerfile`、`.github/workflows/release.yml`

## 3. 目录

```
server/src/   Express 入口、鉴权、DB、WS、路由、zod、错误处理
web/src/      React 应用；components/ 与同名 CSS；plugins/ 沙箱与能力桥
docs/         SPEC / CONTEXT / PLUGINS / DESIGN / DEV / DEPLOY / adr / specs / review
scripts/dev.sh
Dockerfile    根目录多阶段单容器构建
.github/workflows/release.yml
```

`.gitignore` 已排除，不要提交：`node_modules/`、`dist/`、`preview/`、`extensions/`、`docker/`、`server/data/`、`.env`、`*.db*`、`.DS_Store`。

## 4. 分支策略

| 分支 | 角色 |
|------|------|
| `main` | 发布分支，始终可部署；只接受来自 `dev` 的合并 |
| `dev` | 开发集成分支，所有功能/修复/文档/杂务提交都在这里 |

- 禁止直接向 `main` 提交。提交前用 `git branch --show-current` 确认在 `dev`；本地无 `dev` 时 `git switch -c dev --track origin/dev`
- 只有功能测试完全通过才允许合并 `main`
- 合并 `main`、改版本号、打 tag、push 均由维护者手动执行，Agent 不得操作

## 5. Commit 政策

**每完成一组改动就提交，不要攒批；小而可审查的提交是常态。**

格式：`type(scope): 中文描述`

- `type` 英文：`feat` / `fix` / `docs` / `chore` / `refactor` / `style` / `test` / `perf` / `ci` / `build`
- `scope` 可选、英文小写：`web` / `server` / `api` / `ui` / `plugins` / `deploy` / `spec` / `ci` / `version`

```
chore: 初始化工作区
docs: 定义仓库协作契约
feat(web): 新增媒体库外壳
feat(api): 新增健康检查与任务路由
fix(worker): 稳定队列启动
```

- 一组逻辑改动一个 commit，不混入无关修改、格式化或重构
- 每个 commit 应通过对应端 typecheck，不提交损坏的中间状态
- 不提交生成物、运行数据、密钥；不 amend 已发布 commit、不强推、不使用 `--no-verify`
- **本地 commit 后不 push**，除非维护者明确要求

## 6. 命令与验证

```bash
bash scripts/dev.sh                     # 一键启动，读取根目录 .env 的 API_KEY
cd server && API_KEY=<密钥> npm run dev  # tsx watch，3000
cd web && npm run dev                   # Vite，5173
cd server && npm run typecheck          # tsc --noEmit
cd server && npm run build
cd web && npm test                      # vitest run
cd web && npx tsc -b                    # 类型检查（tsconfig 已 noEmit）
cd web && npm run build                 # tsc -b + vite build
```

环境变量：`API_KEY` 必填；`PORT` 默认 3000；`DATA_DIR` 默认 `./data`；`PUBLIC_DIR` 默认 `./public`。

提交前按范围验证，并在交付说明中列出命令与结果：

| 改动范围 | 必须执行 |
|----------|----------|
| 仅文档 | 核对命令、路径、链接与代码一致 |
| `web/` | `npm test` + `npx tsc -b`；UI 改动加浏览器实测 |
| `server/` | `npm run typecheck`；行为变更加 curl 验证（见 `docs/DEV.md`） |
| 插件 | `npm test`（解析/匹配/能力桥）+ `docs/PLUGINS.md` 4.5 手工验收 |
| 构建/依赖/Docker/CI | 两端构建 + `npm ci --dry-run --prefix web` / `--prefix server` |
| 每次 commit 前 | 两端 typecheck 都跑一遍 |

- 无 lint 脚本；Web 测试只覆盖纯逻辑模块，`App.tsx` 等核心 UI 改动必须人工验证
- 无法完成浏览器实测时，明确写出「未验证」，不得声称已通过

## 7. 代码约定

- 两端 `strict`；注释与文档中文，标识符英文；2 空格、单引号、分号
- 最小改动：不做任务之外的顺手重构或抽象；新增运行时依赖先说明理由
- Server：ESM 相对导入**必须带 `.js` 后缀**；外部输入在 `validation.ts` 用 zod 校验（内容上限 1MB）；错误响应 `{ "error": { "code", "message" } }`；SQL 全程参数化；不新增 CORS
- 改 API/WS 字段时，同步 `web/src/types.ts`、`web/src/ws.ts` 与 `docs/SPEC.md`
- Web：API 集中在 `api.ts`，WS 在 `ws.ts`；组件与同名 CSS 同目录；纯逻辑抽成可测试模块；localStorage 键用 `clipnote_*` 前缀，改名走 `migrateStorageKey`
- 移动端判定按 `CONTEXT.md`（`pointer: coarse` + `maxTouchPoints` + UA），**不要用视口宽度**
- 已知坑：`web/vite.config.js` 与 `.ts` 并存且 Vite 优先读 `.js`，改配置必须同步两个文件；静态托管与 SPA fallback 有意放在鉴权之前，勿调整；`docs/review/代码高危审计.md` 是历史快照，以当前代码为准

## 8. 安全红线

- 不记录、不提交、不写入文档任何真实 `API_KEY`；`.env` 仅本地
- 不削弱鉴权：`/api/*` 与 `/ws` 必须校验 API Key；不放开 CORS
- API 入参必须 zod 校验；SQL 只用参数化查询；前端不用 `dangerouslySetInnerHTML`
- 插件执行模型不可回退：
  - 文本处理与工具栏插件都在 **Web Worker** 执行，宿主超时 3 秒
  - 工具栏特权操作只能经**能力桥**（`clipnote.open/copy/storage/systemNotify`）由主线程校验后代执行；`open` 仅放行 `http/https` 且带 `noopener`
  - 不恢复主线程 `new Function` 直接执行，不重新引入「安装即信任」替代沙箱
  - Worker 保留原生网络能力（fetch/XHR/importScripts），文档必须如实说明，禁止宣称「沙箱内不能联网」
- 插件行为变化同步更新 `docs/PLUGINS.md`；新增端口/服务/部署拓扑变化同步更新 `SPEC.md` 与 `DEPLOY.md`

## 9. 文档体系

| 文档 | 何时更新 |
|------|----------|
| `docs/SPEC.md` | API、数据模型、架构、WS、安全、部署拓扑变化 |
| `CONTEXT.md` | 新增或调整领域术语 |
| `docs/PLUGINS.md` | 插件格式、契约、能力变化 |
| `docs/DESIGN.md` | 视觉规范或组件样式变化 |
| `docs/DEV.md` / `docs/DEPLOY.md` / `README.md` | 命令、部署、镜像信息变化 |
| `docs/adr/000N-*.md` / `docs/specs/YYYY-MM-DD-*.md` | 不可逆决策 / 大功能设计 |

代码与相关文档在同一个 commit 更新；文档必须与实现一致，不把未实现的安全边界写成事实；ADR 被取代时新建 ADR，不改写已接受的结论。

## 10. 版本与发布（维护者手动）

Agent 不得合并 `main`、改版本、打 tag 或 push，只能在准备就绪时报告。

维护者流程：`dev` → `main`（测试全通过）→ 更新 **4 处**版本（`server/package.json`、`server/package-lock.json`、`web/package.json`、`web/package-lock.json`）→ 提交 `chore: 升级版本至 x.y.z` → 在 `main` 打 `vX.Y.Z` tag 并推送。CI 校验 lockfile 同步，构建 `linux/amd64` + `linux/arm64` 并推送 GHCR、创建 Release。镜像 tag：`latest`、`X.Y`、`X.Y.Z`。

## 11. Agent 准则

1. 先读文档与现有实现，确认需求/根因再动手
2. 只做被要求的事，最小 diff
3. 所有提交落在 `dev`；发现自己在 `main` 立即停下并切换
4. 每组可审查的改动完成后立即 commit，不攒批
5. 跑完第 6 节要求的检查；UI 尽量浏览器实测，做不到就说明
6. 不 push、不合并、不打 tag、不改版本；不执行 `git reset --hard`、`git checkout --`、`git clean -f`、强推等可能丢失工作的命令
7. 只删除任务点名内容；不确定时先询问或改用可逆操作；交付说明只写改动、验证结果、未验证项、下一步
