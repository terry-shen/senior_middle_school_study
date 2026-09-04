## Why

当前知识点导入功能强依赖大模型进行文本分析和自动分类，但本地 Ollama 模型处理中文复杂数学文本时效果差、速度慢，云端模型配额也已耗尽，导致导入功能实际不可用。用户提出更合理的方案：知识点应在导入前由教师整理好，通过 Excel 模板按 4-5 层树结构导入，并在导入后支持人工编辑校准，确保数据质量。该方案与试题导入的"导入→编辑→预览→确认"流程一致，零 LLM 依赖、快速可靠。

## What Changes

- **新增 Excel 模板下载**：后端动态生成 `.xlsx` 模板文件，含3个 Sheet（知识点导入表、填写说明、完整示例），供教师下载填写
- **新增 Excel 解析功能**：后端解析上传的 Excel 文件，按层级1-5列宽表格式构建知识树结构，提取描述、要点解读、建议学时等字段
- **新增预览与编辑校准**：前端展示解析后的知识树（树形可视化 + 表格编辑器），支持人工编辑每个知识点的字段、层级、父节点关系，校准后再确认导入
- **新增确认导入端点**：确认后将校准后的知识点写入数据库，支持增量导入（code 匹配 → 更新；新 code → 创建）
- **移除 LLM 依赖**：删除 `autoAnalyzeKnowledgePoints()` 和 `extractKnowledgePointsFromFile()` 等 LLM 相关函数，导入流程不再调用大模型
- **BREAKING**：移除文件上传 + LLM 自动分析的导入方式（PDF/DOCX/TXT → LLM 提取），改为纯 Excel 模板方式
- **保留人工编辑能力**：导入确认后仍可再次编辑知识点树（复用现有 KnowledgePointManagement 页面的编辑/删除功能）

## Capabilities

### New Capabilities

无新建能力。修改已有能力 `knowledge-point-import`。

### Modified Capabilities

- `knowledge-point-import`: 将"多渠道LLM导入"需求改为"Excel模板导入"，将"自动分类与映射"改为"Excel解析+树结构构建"，新增"模板下载"、"预览编辑校准"、"确认导入"需求，移除"知识点融合"（LLM依赖）

## Impact

- **后端**：`backend/src/services/knowledge-point-import-service.ts` 重写（移除LLM函数，新增Excel解析）；`backend/src/routes/knowledge-points.ts` 修改模板下载/预览/确认端点
- **前端**：`frontend/src/pages/KnowledgePointImport.tsx` 重写（多文件上传→Excel下载+上传+树形预览+表格编辑+确认）；`frontend/src/services/knowledge-point-import-api.ts` 重写（新增模板下载、Excel上传预览、确认导入函数）
- **依赖**：`exceljs` 已安装（后端用于生成/解析 Excel）；`multer` 已安装（文件上传）
- **数据库**：无 schema 变更，KnowledgePoint 模型已有 code/name/parentId/level/masteryLevel/suggestedHours/description 字段
- **移除依赖**：不再依赖 `word-service.ts`、`text-service.ts` 的文件解析能力（仅用于知识点导入，试卷导入不受影响）
