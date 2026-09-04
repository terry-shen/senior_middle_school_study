## Why

当前试题导入仅支持PDF和图片两种格式。教师日常工作中，大量试卷以Word文档（.docx/.doc）或纯文本（.txt）形式存在——教师在Word中编辑试卷后直接导出，或在文本编辑器中整理题目。要求用户先将Word转为PDF再导入增加了操作门槛，降低了系统在真实教学场景中的可用性。支持Word和TXT导入能覆盖90%以上的试卷文件来源。

## What Changes

- 新增Word文档（.docx）导入支持：解析Word文档内容（含段落、表格、图片），提取文本并复用现有试题拆分流程
- 新增旧版Word文档（.doc）导入支持：通过文本提取方式处理旧格式
- 新增纯文本（.txt）导入支持：直接读取文本内容，走试题拆分流程
- 扩展上传文件类型白名单：从 `pdf,image/*` 扩展为 `pdf,image/*,.docx,.doc,.txt`
- 前端导入界面增加文件格式选择提示和多格式拖拽支持
- 导入API统一入口：保持现有 `/api/papers/import` 端点，根据文件扩展名自动路由到对应的解析服务

## Capabilities

### New Capabilities
<!-- 本变更不引入新能力，仅扩展现有exam-paper-import能力 -->

### Modified Capabilities
- `exam-paper-import`: 新增Word文档和TXT纯文本格式的导入支持，扩展"多格式试卷导入"需求

## Impact

- **后端**：新增Word解析服务（使用mammoth或docx库提取文本），扩展upload-service的文件类型白名单，修改papers路由的import端点支持新格式
- **前端**：PaperImport页面更新文件接受类型，添加格式选择提示
- **依赖**：新增npm包 `mammoth`（.docx文本提取）和 `iconv-lite`（TXT编码检测，处理GBK/UTF-8）
- **数据库**：ExamPaper模型新增可选字段 `sourceFormat`（标识导入来源格式：pdf/image/word/txt）
- **兼容性**：完全向后兼容，现有PDF和图片导入不受影响
