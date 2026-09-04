## Why

当前试卷导入流程是"黑盒自动化"：PDF → MinerU转换 → 正则自动拆分 → 题目入库。MinerU输出的Markdown质量尚可（含LaTeX公式），但自动拆分极度脆弱——题号不在行首、解析文本内含数字、答案标记位置不一致等问题导致拆分错误率高达30%+（18题试卷拆成28题）。出错后用户无人工干预入口，只能重新导入。需要将"机器全自动化"改为"机器辅助+人工校准"的人机协同模式。

## What Changes

- **新增结构化编辑器页面**：MinerU转换后，用户可在结构化编辑器中预览Markdown全文（含LaTeX渲染+图片显示），修正OCR错误后保存为校准版Markdown
- **新增拆分预览功能**：基于校准后的Markdown执行拆分，显示拆分结果列表（题号+内容+答案+解析），用户可微调后确认入库
- **新增渐进式流程**：用户可选择"直接确认"（拆分结果可接受时跳过编辑器）或"进入编辑器修正"（拆分结果不可接受时进入结构化编辑）
- **新增试卷状态流转**：uploaded → editing → split_preview → completed，支持草稿保存
- **修改导入流程**：导入后不再自动拆分入库，而是进入"待确认"状态，等待用户预览/编辑/确认
- **MinerU作为可见工具嵌入**：前端可见MinerU转换状态和结果，而非隐藏的后端服务
- ExamPaper模型新增 `editedMarkdown` 字段存储用户校准后的Markdown

## Capabilities

### New Capabilities
- `paper-edit-workflow`: 试卷编辑工作流，包含结构化编辑器（Markdown编辑+实时预览）、拆分预览（拆分结果列表+单题微调）、渐进式确认流程（直接确认/编辑后确认）、草稿保存

### Modified Capabilities
- `exam-paper-import`: 修改导入流程——导入后不再自动拆分入库，改为进入"待确认"状态；新增 editedMarkdown 字段；状态流转扩展为 uploaded → editing → split_preview → completed

## Impact

- **后端新增端点**：PUT /api/papers/:id/markdown（保存校准Markdown）、POST /api/papers/:id/split-preview（预览拆分不入库）、POST /api/papers/:id/confirm-import（确认导入入库）
- **后端修改**：papers.ts导入路由不再自动调用splitQuestionsFromPaper，改为创建试卷后返回待确认状态
- **前端新增页面**：PaperEdit.tsx（结构化编辑器）、SplitPreview.tsx（拆分预览）
- **前端修改**：PaperImport.tsx导入成功后跳转到编辑/预览页面
- **数据库**：ExamPaper新增 editedMarkdown String? 字段，新增状态值 editing/split_preview
- **复用现有代码**：mineru-service.ts（转换）、splitQuestionsFromMarkdown()（拆分）、MathText.tsx（LaTeX渲染）、QuestionList 3-block布局（拆分预览样式）
