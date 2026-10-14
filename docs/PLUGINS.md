# ClipNote 插件规范 (.CVT)

ClipNote 插件系统按类型分为多个子模块，统一以 `.CVT` 文件编写、通过「插件管理」界面导入、存储在服务器上供所有设备共享：

- **文本处理插件**（`text-transform`，缺省类型）：运行在前端 Web Worker 沙箱中的纯文本变换脚本——一个入口（条目文本），一个出口（处理后的文本）。本文 1–6 节描述此类型。
- **文本选择工具栏插件**（`selection-toolbar`）：针对选中文本区段触发的动作脚本——单一文本入口、无文本出口。见第 7 节。

## 1. 文件格式

`.CVT` 文件为 UTF-8 编码的纯文本，由两部分组成：

1. **元数据块**（必须）：文件开头的块注释，标记为 `ClipNote-Plugin`，内部是合法 JSON
   （旧名称 `ClipVault-Plugin` 仍可正常导入，兼容既有插件）
2. **代码体**（必须）：元数据块之后的全部内容，定义 `process` 函数

```text
/* ClipNote-Plugin
{
  "id": "trim-whitespace",
  "name": "去除首尾空白",
  "author": "KanataN",
  "version": "1.0.0",
  "description": "移除文本开头和结尾的空格、制表符与换行",
  "github_url": "github.com/KanataN"
}
*/
function process(input) {
  return input.trim();
}
```

## 2. 元数据字段

| 字段 | 类型 | 必填 | 约束 | 说明 |
|---|---|---|---|---|
| `id` | string | 是 | 3–64 字符，小写字母/数字/短横线组成的 slug（如 `trim-whitespace`），不能以短横线开头或结尾 | 插件唯一标识；相同 `id` 再次导入视为**更新**同一插件 |
| `name` | string | 是 | 1–100 字符，去除首尾空白后非空 | 插件名称，展示用；不同插件允许重名 |
| `author` | string | 是 | 1–100 字符 | 作者名 |
| `version` | string | 是 | `x.y.z` 格式（每段为数字） | 语义化版本 |
| `description` | string | 是 | 1–1000 字符 | 功能描述，展示在插件管理详情页 |
| `github_url` | string | 否 | GitHub 用户主页链接，接受 `github.com/<用户名>` 或 `https://github.com/<用户名>`（可带 `www.` 与尾部 `/`），存储时归一化为 `https://github.com/<用户名>` | 填写后详情页作者旁显示 GitHub 图标（点击跳转主页），并用 GitHub 头像替换文字头像 |

## 3. 代码契约

- 必须定义一个名为 **`process`** 的函数，签名：`function process(input: string): string`
- `input` 为剪贴板条目的完整文本；返回值为覆盖原条目的新文本
- 返回空字符串是合法的（会覆盖为空文本），但 `process` 抛出异常会导致本次处理失败
- 必须是**同步纯函数**：不使用 `async`/`await`、`Promise`、回调
- 不允许访问任何外部资源：沙箱中不存在 `DOM`、`fetch`/`XMLHttpRequest`、`localStorage`、`import` 等能力
- 执行超时为 **3 秒**，超时会被强制终止并视为失败

失败行为（异常或超时）：不覆盖原条目，界面上提示插件错误，原文保持不变。

## 4. 内置全局能力

沙箱中除标准 ECMAScript 内置对象（`String`/`RegExp`/`JSON`/`Array`/`Math`/`Date` 等）外，额外提供：

| 全局 | 类型 | 说明 |
|---|---|---|
| `input` | string | 与 `process(input)` 的参数相同，两种取材方式二选一 |

## 5. 完整示例

### 示例 1：去除首尾空白

```text
/* ClipNote-Plugin
{
  "id": "trim-whitespace",
  "name": "去除首尾空白",
  "author": "KanataN",
  "version": "1.0.0",
  "description": "移除文本开头和结尾的空格、制表符与换行",
  "github_url": "github.com/KanataN"
}
*/
function process(input) {
  return input.trim();
}
```

### 示例 2：多行合并为一行

```text
/* ClipNote-Plugin
{
  "id": "merge-lines",
  "name": "合并为一行",
  "author": "KanataN",
  "version": "1.0.0",
  "description": "把多行文本压缩成单行,行与行之间用一个空格分隔"
}
*/
function process(input) {
  return input
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .join(' ');
}
```

### 示例 3：自定义替换(修改正则即可)

```text
/* ClipNote-Plugin
{
  "id": "fullwidth-to-halfwidth",
  "name": "全角转半角",
  "author": "KanataN",
  "version": "1.0.0",
  "description": "把文本中的全角数字与字母转换为半角"
}
*/
function process(input) {
  return input.replace(/[Ａ-Ｚａ-ｚ０-９]/g, (ch) =>
    String.fromCharCode(ch.charCodeAt(0) - 0xfee0),
  );
}
```

## 6. 导入与生命周期

- 导入入口：「插件管理」界面（Header 插件按钮进入）→ 导入 .CVT 文件
- 相同 `id` 的插件再次导入视为**更新**（名称、作者、版本、描述、GitHub 链接、代码均被替换）
- 启用规则**按类型区分**：
  - 文本处理插件为**单选启用**：同一时间最多只有一个处于启用状态；条目上的插件按钮执行当前启用的插件，没有任何启用插件时不显示按钮；启用新插件会自动禁用之前的文本处理插件
  - 文本选择工具栏插件为**多选启用**：多个可同时处于启用状态，互不影响，也不影响文本处理插件的启用状态
- 新导入的插件默认未启用，需在插件管理界面手动启用
- 插件可被删除（删除当前启用的文本处理插件后，主界面插件按钮消失）
- 覆盖原文前的备份 `original_content` 保存在条目上，与插件删除无关，撤销能力不受影响

## 7. 文本选择工具栏插件（selection-toolbar）

文本选择工具栏插件把自定义动作挂到**文本选择工具栏**上：在桌面模式下选中条目正文文本后，所有正则匹配选中文本的已启用工具栏插件会以按钮形式出现在工具栏上（与内置的「复制文本」「跳转到网页」并列）。点击按钮执行插件代码。**仅桌面模式可用**，移动端选区工具栏禁用。

### 元数据字段

除基础字段（`id`/`name`/`author`/`version`/`description`/`github_url`）外，还需：

| 字段 | 类型 | 必填 | 约束 | 说明 |
|---|---|---|---|---|
| `type` | string | 是 | 须为 `"selection-toolbar"` | 插件类型标识 |
| `regex` | string | 是 | 1–500 字符，须为合法正则 | 声明式匹配规则；宿主用 `RegExp.test`（子串匹配）对选中文本判断是否显示按钮。插件代码不参与匹配 |
| `button_name` | string | 是 | 1–8 个字符 | 按钮显示的功能名称 |

### 代码契约

- 仍须定义 **`process`** 函数，`input` 为**选中的文本**（不是整条剪贴板内容）
- **单一入口、无出口**：返回值不产生新文本、不覆盖条目，仅用于成功反馈
- 支持 `async`：**resolve = 成功**，宿主自动弹出成功通知；`resolve('自定义文案')` 可定制通知文案，无参 resolve 显示默认文案
- **throw / reject = 失败**，宿主自动弹出失败通知（`Error.message` 会展示，否则显示通用文案）
- **无沙箱**：插件代码运行在主线程，可使用全部 Web API——`window.open` 跳转网页、`navigator.clipboard.writeText` 写剪贴板、DOM 等。插件仅运行在客户端浏览器
- ⚠️ **信任提示**：免沙箱意味着插件代码与你访问的网页脚本同等权限，可读取页面内任何数据。**只安装可信来源的插件**（决策详见 `docs/adr/0002`）

### 完整示例

示例文件见仓库 `examples/` 目录：

- `examples/douban-search.cvt` — 选中 ISBN 时跳转豆瓣搜索（`window.open` 跳转 + 正则匹配演示）
- `examples/copy-selection.cvt` — 把选中文本写入系统剪贴板（`navigator.clipboard` + resolve 自定义文案演示）

### 手工验收清单

1. 启动开发环境（`./scripts/dev.sh`），登录后进入「插件管理」
2. 导入 `examples/douban-search.cvt` 与 `examples/copy-selection.cvt` → 两者出现在「文本选择工具栏插件」分区
3. 同时启用两者 → 两者均显示「启用中」，互不干扰
4. 在主界面选中一条含 ISBN 的条目正文（如 `9787020002207`）→ 约 0.8 秒后工具栏出现，含「查豆瓣」「复制选中」按钮
5. 点击「查豆瓣」→ 工具栏收起，新标签页打开豆瓣搜索，弹出成功 toast
6. 选中任意文本，点击「复制选中」→ toast 显示「已复制选中的 N 个字符」
7. 选中不含 ISBN 的普通文本 → 只出现「复制选中」（及 URL 场景的内置按钮），不出现「查豆瓣」
8. 选中无任何插件命中的文本（先把「复制选中」禁用）→ 工具栏只有内置按钮，与改动前一致
9. 导入一个 `process` 内 `throw new Error('测试失败')` 的临时插件 → 点击后弹出失败 toast，且工具栏可继续正常使用
