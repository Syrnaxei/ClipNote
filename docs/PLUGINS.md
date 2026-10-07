# ClipNote 插件规范 (.CVT)

ClipNote 文字处理插件是运行在**前端 Web Worker 沙箱**中的纯文本变换脚本：一个入口（条目文本），一个出口（处理后的文本）。插件以 `.CVT` 文件编写，通过「插件管理」界面导入，存储在服务器上供所有设备共享。

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
- 插件为**单选启用**：同一时间最多只有一个插件处于启用状态；条目上的插件按钮执行当前启用的插件，没有任何启用插件时不显示按钮
- 新导入的插件默认未启用，需在插件管理界面手动启用；启用新插件会自动禁用之前的插件
- 插件可被删除（删除当前启用插件后，主界面插件按钮消失）
- 覆盖原文前的备份 `original_content` 保存在条目上，与插件删除无关，撤销能力不受影响
