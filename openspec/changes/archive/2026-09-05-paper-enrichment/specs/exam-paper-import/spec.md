## MODIFIED Requirements

### Requirement: 试题导入后直接入库

系统 SHALL 在试卷导入并拆分题目后，直接将试题入库，不自动调用 AI 分析模块。试题的答案、解析、题型、分值由 MinerU 拆分时从原文自动提取（【答案】/【解析】标记后的内容）。难度评估作为独立可选步骤，由管理员在难度管理界面手动触发。系统 SHALL 支持在确认导入（confirm-import）时，采用经人工审核通过的 AI 清洗结果（见 paper-question-enrichment 能力）替换对应的题目文本；AI 清洗不是导入的自动步骤。

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

#### Scenario: 确认导入采用 AI 清洗结果

- **WHEN** 管理员确认导入试卷时，该试卷存在状态为"接受"的 AI 清洗提议
- **THEN** 系统 SHALL 使用清洗后的题目文本（content/options）创建或更新对应的 Question 记录
- **AND** 清洗提议未覆盖的题目 SHALL 使用原文

#### Scenario: 确认导入无需 AI 清洗

- **WHEN** 管理员确认导入试卷时，该试卷不存在任何 AI 清洗提议
- **THEN** 系统 SHALL 按现有行为直接以原文入库，AI 清洗不影响正常导入流程