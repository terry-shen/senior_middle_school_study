## MODIFIED Requirements

### Requirement: 试卷结构解析

系统 SHALL 自动识别试卷的结构，包括题号、题型（选择题/填空题/解答题等）、分值等信息。当文档包含数学公式、化学方程式或物理符号等特殊内容时，系统 SHALL 自动检测并委托 mcq-extractor 微服务进行公式感知提取，替代纯文本提取方式，确保数学公式在提取过程中不丢失。

#### Scenario: 自动识别题型

- **WHEN** 系统解析导入的试卷
- **THEN** 系统自动标注每道题的题型（选择题/填空题/解答题）

#### Scenario: 自动识别分值

- **WHEN** 试卷中标注了各题分值
- **THEN** 系统提取并关联到对应的试题

#### Scenario: 手动修正结构

- **WHEN** 用户发现解析错误并进行修正
- **THEN** 系统更新试卷结构并保存修正结果

#### Scenario: 包含数学公式的试卷解析

- **WHEN** 导入的试卷文档包含数学公式（如分数、根号、积分、上下标等）
- **THEN** 系统 SHALL 检测到文档包含数学内容
- **AND** 系统 SHALL 通过 mcq-extractor 微服务进行公式感知提取
- **AND** 提取的题目内容 SHALL 保留数学公式原文（Unicode 符号或 LaTeX 格式）
- **AND** 提取结果在前端 SHALL 通过 KaTeX 正确渲染显示

#### Scenario: 不包含数学公式的试卷解析

- **WHEN** 导入的试卷文档不包含数学公式
- **THEN** 系统 SHALL 使用现有的纯文本提取方式（pdfjs-dist 或 mammoth）
- **AND** 提取行为与当前实现一致

#### Scenario: mcq-extractor微服务不可用时的回退

- **WHEN** mcq-extractor 微服务不可用（未启动或超时）
- **AND** 文档包含数学公式
- **THEN** 系统 SHALL 回退到纯文本提取方式
- **AND** 系统 SHALL 在返回结果中标记 `fallback: true` 警告内容
- **AND** 系统 SHALL 在日志中记录微服务不可用的警告

### Requirement: 导入时自动AI分析

系统 SHALL 在试卷导入并拆分题目后，自动调用AI分析模块生成每道题的答案、解析和知识点。当 mcq-extractor 微服务返回结构化题目数据时，系统 SHALL 使用该数据作为 AI 分析的输入，替代从纯文本拆分的结果。

#### Scenario: 自动生成答案和解析

- **WHEN** 系统完成试卷拆分，创建独立试题记录
- **THEN** 系统自动调用大模型为每道题生成标准答案和详细解析

#### Scenario: 自动识别知识点

- **WHEN** 系统完成答案和解析生成
- **THEN** 系统自动调用大模型识别每道题涉及的知识点并关联

#### Scenario: AI分析状态跟踪

- **WHEN** 系统执行自动分析
- **THEN** 系统显示分析进度（已完成/总数），并标记每道题的分析状态

#### Scenario: AI分析失败处理

- **WHEN** 某道题的AI分析失败
- **THEN** 系统标记该题为"待人工补充"，并允许用户手动填写答案和解析

#### Scenario: 用户审核AI结果

- **WHEN** 用户查看自动生成的答案和解析
- **THEN** 用户可编辑、修正或接受AI生成的结果

#### Scenario: 使用mcq-extractor结构化数据进行AI分析

- **WHEN** mcq-extractor 微服务成功提取结构化题目数据（包含题号、题目、选项、答案）
- **THEN** 系统 SHALL 使用 mcq-extractor 返回的结构化数据创建 Question 记录
- **AND** AI 分析 SHALL 基于包含数学公式的题目原文进行知识点识别和解析生成
- **AND** 数学公式在 AI 分析结果中 SHALL 被保留

#### Scenario: 纯文本拆分结果进行AI分析

- **WHEN** mcq-extractor 微服务不可用或未提取到结构化题目
- **THEN** 系统 SHALL 使用现有的 `question-splitting-service.ts` 从纯文本拆分题目
- **AND** AI 分析流程与当前实现一致
