## ADDED Requirements

### Requirement: 试题导入后直接入库

系统 SHALL 在试卷导入并拆分题目后，直接将试题入库，不自动调用 AI 分析模块。试题的答案、解析、题型、分值由 MinerU 拆分时从原文自动提取（【答案】/【解析】标记后的内容）。难度评估作为独立可选步骤，由管理员在难度管理界面手动触发。

#### Scenario: 导入后直接入库

- **WHEN** 系统完成试卷拆分，创建独立试题记录
- **THEN** 系统直接将试题存入数据库，不调用大模型生成答案、解析或知识点

#### Scenario: 答案和解析从原文提取

- **WHEN** MinerU 解析的 Markdown 包含【答案】和【解析】标记
- **THEN** 系统在拆分时自动将标记后的内容分别存入 Question.answer 和 Question.analysis 字段

#### Scenario: 原文无答案标记

- **WHEN** MinerU 解析的 Markdown 不包含【答案】或【解析】标记
- **THEN** 系统将对应字段留空，教师可在题库管理界面手动编辑补充

#### Scenario: 难度评估可选触发

- **WHEN** 管理员需要对试题进行难度评估
- **THEN** 管理员在难度管理界面选择试题并点击"AI评估"，系统调用 difficulty-service 进行难度评估（此为独立流程，不在导入时自动触发）

#### Scenario: 用户手动编辑答案解析

- **WHEN** 教师在题库管理界面发现某题的答案或解析不完整
- **THEN** 教师可直接编辑试题的 answer 和 analysis 字段并保存

## REMOVED Requirements

### Requirement: 导入时自动AI分析

**Reason**: 原 requirement 要求导入后自动调用 AI 生成答案、解析、知识点，现 AI 分析全部废弃（question-analysis capability 整体移除）。答案和解析改为 MinerU 拆分时从原文【答案】/【解析】标记提取，不再需要 AI 生成。

**Migration**: 使用新的"试题导入后直接入库"requirement。导入流程不触发 AI 分析，答案/解析由拆分服务自动提取或教师手动编辑。

### Requirement: 导入结果预览与确认

**Reason**: 预览与确认流程中的"自动生成的答案、解析、知识点"依赖 AI 分析，已废弃。当前的导入流程已改为"MinerU 解析→富文本编辑器校准→确认拆分→入库"的渐进式流程（由 mineru-embedded-workflow 和 tag-based-question-splitting 变更实现），预览步骤已整合到编辑器中。

**Migration**: 导入流程保持现有的"编辑校准→拆分预览→确认导入"三步流程（PaperEdit + SplitPreview），预览内容来自 MinerU 原文拆分而非 AI 生成。无需独立的"AI 分析结果预览"。
