# 001 - type 字段全链路（解析 + 存储 + 启用语义）

**Blocked by**: 无

## 目标
导入一个 `type: "selection-toolbar"` 的 .CVT 能完整入库并按新启用语义生效；旧格式 .CVT 导入行为与现状完全一致。

## 涉及层
- [x] 逻辑层：`web/src/plugins/parseCvt.ts` — `CvtMeta` 新增 `type`（缺省 `'text-transform'`；未知值报错）；`type === 'selection-toolbar'` 时要求 `regex`（字符串且 `new RegExp` 不抛错）与 `button_name`（1–8 字符）；工具栏元数据存入解析结果（如 `CvtPlugin` 扩展字段或单独的 toolbar meta 接口）
- [x] 数据层：服务端 `plugins` 表新增 `type` 列（迁移脚本，存量行回填 `'text-transform'`）
- [x] 逻辑层：`server/src/validation.ts` + `server/src/routes/plugins.ts` — create/update schema 接受 `type`/`regex`/`button_name`（服务端存完整解析后的字段或仅存 type+code，与现有 code 存储方式保持一致）；GET 返回 `type`；单启用清零（`UPDATE plugins SET enabled = 0`）改为仅作用于 `type = 'text-transform'`
- [x] 测试：parseCvt 新校验用例（type 缺省/合法/未知、regex 非法、button_name 超长）；服务端启用语义用例（启用工具栏插件不清零其他工具栏插件、启用文本处理插件仍清零全部文本处理且不动工具栏插件）

## 验收标准
- 无 `type` 字段的存量 .CVT 解析、导入、启用行为与变更前完全一致
- `curl POST /api/plugins` 导入 selection-toolbar 类型后，`GET` 能返回其 `type`，可重复导入更新
- 启用一个工具栏插件后，其他已启用工具栏插件的 enabled 不变
- 启用一个文本处理插件后，其余文本处理插件全部变为未启用
- 非法 regex / 超长 button_name / 未知 type 的 .CVT 导入被拒，报错信息指明字段
