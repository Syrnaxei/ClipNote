# 0003 - 文本选择工具栏插件迁入 Worker 沙箱与能力桥

日期：2026-10-20
状态：已接受（取代 ADR 0002）

## 背景

ADR 0002 的免沙箱决策留下三个不可收口的问题（2026-10-14 安全审查确认）：主线程执行可读取页面全部状态（含 localStorage 中的 API key，即全站读写权）；同步死循环等失控代码无法中断，只能冻结页面；且 github 头像/主页等社交分发特征表明插件市场式分发正在成型，触发了 0002 结尾「需重审」的前提。

## 决策

文本选择工具栏插件迁入 Web Worker 沙箱执行（与文本处理插件同容器思路），特权操作一律通过**能力桥**完成：沙箱内调用 `clipnote.*` → postMessage 到主线程 → 校验后代为执行。首发能力：`clipnote.open`（noopener + 仅放行 http/https）、`clipnote.copy`、`clipnote.storage`（按插件 id 隔离的私有 KV）、`clipnote.systemNotify`；`clipnote.fetch`、`clipnote.openView` 留二期。Worker 内原生网络能力（fetch/XHR/importScripts/WebSocket）**保留不禁用**。执行超时 3 秒，含能力桥往返。不做旧插件兼容，干净切换（旧 `window.open` 写法直接报错）。信任机制随沙箱化删除——沙箱已收住其防御的风险面；`PluginTrustModal` 组件保留供未来插件类型复用。

## 备选方案

- 保留主线程执行：否决，密钥外泄与死循环冻结无法在主线程模型内解决。
- 声明式权限模型（.cvt 元数据声明能力 + 逐项授权）：否决，单用户自部署场景下授权摩擦大于收益。
- 禁用 Worker 原生网络、强制走桥：否决（本次），与「安装即信任」的宽松哲学不一致；二期 `clipnote.fetch` 落地时可再评估。

## 后果

- 密钥外泄、主线程冻结、ReDoS 冻结页面等风险随主线程执行一并消失。
- 现有插件需迁移：`window.open(...)` → `clipnote.open(...)`，示例插件与 PLUGINS.md 同步更新。
- 文档必须如实描述安全边界：沙箱内无 DOM/localStorage/clipboard，但**可发起任意网络请求**。
- 特权操作需用户激活的浏览器约束不变（clipboard 写入、window.open 仍要求用户手势上下文）。
