## MODIFIED Requirements

### Requirement: 试卷结构解析
系统 SHALL 自动识别试卷的结构，包括题号、题型（选择题/填空题/解答题等）、分值等信息。当文档包含数学公式时，系统 SHALL 优先使用 MinerU 进行文档解析，自动将数学公式识别并转换为 LaTeX 格式输出，确保数学公式在提取过程中完整保留。MinerU 不可用时，系统 SHALL 回退到 mcq-extractor 微服务，再不可用时回退到纯文本提取（pdfjs-dist/mammoth）。

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
- **WHEN** 导入的试卷文档包含数学公式（如分数、根号、积分、上下标、向量等）
- **AND** MinerU 服务可用
- **THEN** 系统 SHALL 优先通过 MinerU 解析文档
- **AND** 输出 SHALL 为 Markdown 格式，其中数学公式转为 LaTeX（行内 `$...$`，独立 `$$...$$`）
- **AND** 表格 SHALL 转为 HTML 格式
- **AND** 图片 SHALL 提取为独立文件并在 Markdown 中引用
- **AND** 提取的题目内容 SHALL 保留完整数学公式（LaTeX 格式）
- **AND** 提取结果在前端 SHALL 通过 KaTeX 正确渲染显示
- **AND** 当 MinerU 不可用但 mcq-extractor 可用时，系统 SHALL 通过 mcq-extractor 微服务进行公式感知提取，提取的题目内容 SHALL 保留数学公式原文（Unicode 符号或 LaTeX 格式），提取结果在前端 SHALL 通过 KaTeX 正确渲染显示

#### Scenario: 不包含数学公式的试卷解析
- **WHEN** 导入的试卷文档不包含数学公式
- **THEN** 系统 SHALL 使用 MinerU 进行解析（如可用）以获得更好的版面分析
- **AND** MinerU 不可用时使用现有的纯文本提取方式（pdfjs-dist 或 mammoth）

#### Scenario: mcq-extractor微服务不可用时的回退
- **WHEN** MinerU 和 mcq-extractor 均不可用（未启动或超时）
- **AND** 文档包含数学公式
- **THEN** 系统 SHALL 回退到纯文本提取方式（pdfjs-dist 或 mammoth）
- **AND** 系统 SHALL 在返回结果中标记 `fallback: true` 警告数学公式可能丢失
- **AND** 系统 SHALL 在日志中记录微服务不可用的警告

### Requirement: 导入时自动AI分析
系统 SHALL 在试卷导入并拆分题目后，自动调用AI分析模块生成每道题的答案、解析和知识点。当 MinerU 解析输出包含 LaTeX 公式的 Markdown 文本时，系统 SHALL 使用该 Markdown 作为题目内容和 AI 分析的输入，LaTeX 公式在 AI 分析结果中 SHALL 被保留。

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
- **WHEN** MinerU 不可用，mcq-extractor 微服务成功提取结构化题目数据（包含题号、题目、选项、答案）
- **THEN** 系统 SHALL 使用 mcq-extractor 返回的结构化数据创建 Question 记录
- **AND** AI 分析 SHALL 基于包含数学公式的题目原文进行知识点识别和解析生成
- **AND** 数学公式在 AI 分析结果中 SHALL 被保留
- **AND** 当 MinerU 成功解析时，系统 SHALL 从 MinerU 输出的 Markdown+LaTeX 中拆分题目，题目内容保留 LaTeX 公式，AI 分析 SHALL 基于包含 LaTeX 公式的题目原文进行知识点识别和解析生成，数学公式在 AI 分析结果中 SHALL 被保留

#### Scenario: 纯文本拆分结果进行AI分析
- **WHEN** MinerU 和 mcq-extractor 均不可用
- **THEN** 系统 SHALL 使用现有的 `question-splitting-service.ts` 从纯文本拆分题目
- **AND** AI 分析流程与当前实现一致
