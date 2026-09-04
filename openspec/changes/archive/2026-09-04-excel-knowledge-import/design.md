# Design: excel-knowledge-import

## Context

当前知识点导入依赖 LLM 解析文本文件，效果差且不可靠。用户提出 Excel 模板 + 人工校准方案，与试题导入流程一致。

## Decisions

### Decision 1: Excel 宽表格式（层级1-5列）

**选择**: 每行一个完整路径的宽表格式（层级1 | 层级2 | ... | 层级5 | 描述 | 要点解读 | 建议学时）

**替代方案**:
- 缩进格式（TreeSheet风格）：每列代表一级缩进，视觉上像树。教师不熟悉，易出错。
- JSON 格式：结构化强但非技术人员难编辑。

**理由**: 宽表格式最直观，教师可在 Excel 中直接填写，支持筛选、排序、批量编辑。留空规则简单：某层为空则该节点到此层为止。

### Decision 2: 模板动态生成（exceljs）

**选择**: 后端用 exceljs 动态生成 .xlsx 文件，含3个 Sheet。

**替代方案**:
- 静态文件托管：把模板文件放在 public/ 目录直接下载。缺点：修改模板需替换文件，不够灵活。
- 前端生成：用 SheetJS 在浏览器生成。缺点：样式控制有限，3-Sheet 结构复杂。

**理由**: exceljs 已安装，支持多 Sheet、单元格样式、列宽、数据验证。动态生成可随时调整模板内容。

### Decision 3: 导入流程三步（上传预览 → 编辑校准 → 确认导入）

**选择**: 与试题导入流程一致的三步式导入。

**流程**:
1. `POST /api/knowledge-points/import/preview` — 上传 Excel，解析返回知识点列表 JSON（不写DB）
2. 前端展示树形预览 + 表格编辑器，用户校准（可选）
3. `POST /api/knowledge-points/import/confirm` — 提交校准后的知识点列表，按 code 匹配创建/更新

**替代方案**:
- 一步导入（上传即入库）：无预览校准，数据质量不可控。
- 两步（上传预览 → 确认）：无编辑校准步骤。

**理由**: 用户明确要求支持人工编辑校准。三步流程与试题导入一致，用户体验统一。

### Decision 4: 知识点编码格式 `KP{parentId}.{序号}`

**选择**: 自动生成编码，格式 `KP01`（根）、`KP01.01`（子）、`KP01.01.01`（孙）。

**替代方案**:
- UUID：唯一性强但不可读，教师无法从 code 推断层级关系。
- 用户自定义 code：增加填写复杂度，易出错。

**理由**: 编码可读性强，从 code 可直接看出层级关系。增量导入通过 code 精确匹配，不会误更新。

### Decision 5: 要点解读存储方式

**选择**: 将要点解读追加到 `KnowledgePoint.description` 末尾，以 `【要点解读】` 分隔符标记。

**替代方案**:
- 新增 `keyPoints` 字段到 schema：需数据库迁移，增加复杂度。
- 单独存储为 JSON：查询不便。

**理由**: 避免数据库 schema 变更。description 字段已存在，追加分隔符标记后在前端可解析展示。若后续需要独立查询要点解读，再考虑新增字段。

## Risks

| 风险 | 影响 | 缓解 |
|------|------|------|
| Excel 模板填写错误 | 解析失败或树结构错误 | 预览校准步骤让用户检查和修正 |
| 同父节点层级不一致 | 树结构混乱 | 预览时标记警告，用户可修正 |
| 大量知识点导入性能 | 确认导入可能慢 | 使用 `createMany` 批量插入，限制单次导入500条 |
| code 冲突（用户手动修改code） | 增量导入误更新 | code 由系统自动生成，前端不允许编辑 code 字段 |

## Migration

- 旧的 LLM 相关函数（`autoAnalyzeKnowledgePoints`、`extractKnowledgePointsFromFile`）从 `knowledge-point-import-service.ts` 中删除
- 旧的 `/import` 和 `/import/preview` 端点改为 Excel 上传方式
- 旧的 `/import/template` 端点从返回 JSON 说明改为返回 .xlsx 文件下载
- 前端 `KnowledgePointImport.tsx` 从多文件上传+LLM改为 Excel 下载+上传+树形预览+编辑校准
- 已导入的知识点不受影响，无需数据迁移
