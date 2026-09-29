## MODIFIED Requirements

### Requirement: 试卷逐题解析拆分

系统 SHALL 自动识别试卷中的每道题目，将其拆分为独立的试题实体。拆分时 SHALL 识别试卷的章节标题（如"一、单项选择题"、"二、多项选择题"、"三、填空题"、"四、解答题"），并将章节题型传递给该章节下的每一道题。

#### Scenario: 自动识别题目边界

- **WHEN** 系统解析导入的试卷
- **THEN** 系统识别题号（如1.、2.、一、二）并定位每道题的边界

#### Scenario: 题目内容提取

- **WHEN** 系统识别到题目边界
- **THEN** 系统提取完整的题目内容（包括题干、选项、图片等）

#### Scenario: 拆分为独立试题

- **WHEN** 系统完成题目识别和提取
- **THEN** 系统将每道题目创建为独立的试题记录，关联到原试卷

#### Scenario: 章节标题识别

- **WHEN** 试卷 Markdown 包含章节标题（如"一、单项选择题"、"二、多项选择题"、"三、填空题"、"四、解答题"）
- **THEN** 系统 SHALL 识别章节标题并映射到题型（单项选择题→single_choice，多项选择题→multiple_choice，选择题→single_choice，填空题→fill，解答题/计算题→essay）
- **AND** 兼容中文数字（一、二、三）、阿拉伯数字（1.、2.）、罗马数字（I.、II.）等多种章节编号格式
- **AND** 兼容"单选题"、"多选题"等简称

#### Scenario: 章节题型继承

- **WHEN** 系统识别到某道题属于"单项选择题"章节
- **THEN** 系统 SHALL 将该题的 questionType 设为 `single_choice`
- **AND** 同一章节下的所有题目继承相同的题型

#### Scenario: 无章节标题时的规则兜底

- **WHEN** 试卷 Markdown 不包含章节标题，或题目不在任何已知章节下
- **THEN** 系统 SHALL 使用增强规则正则识别题型：`A.`/`B.`/`C.`/`D.` 选项模式→single_choice，下划线 `____` 或空括号 `（  ）`→fill，其余长文本→essay
- **AND** 不再使用"内容长度>100→essay"的兜底规则（该规则会误判含 LaTeX 公式的选择题为解答题）

### Requirement: 试卷结构解析

系统 SHALL 自动识别试卷的结构，包括题号、题型（单选题/多选题/填空题/解答题等）、分值等信息。题型枚举 SHALL 包含 5 种：`single_choice`（单选题）、`multiple_choice`（多选题）、`fill`（填空题）、`essay`（解答题）、`unknown`（未识别）。当文档包含数学公式、化学方程式或物理符号等特殊内容时，系统 SHALL 自动检测并委托 mcq-extractor 微服务进行公式感知提取，替代纯文本提取方式，确保数学公式在提取过程中不丢失。

#### Scenario: 自动识别题型

- **WHEN** 系统解析导入的试卷
- **THEN** 系统自动标注每道题的题型（single_choice/multiple_choice/fill/essay/unknown）
- **AND** 优先使用章节标题上下文识别题型，无章节标题时使用规则兜底

#### Scenario: 区分单选题和多选题

- **WHEN** 系统识别到"多项选择题"章节标题，或题目有多个正确答案标记
- **THEN** 系统 SHALL 将该题标注为 `multiple_choice`
- **AND** 与"单项选择题"章节下的题目（标注为 `single_choice`）区分

#### Scenario: LaTeX 公式不干扰题型识别

- **WHEN** 题目内容包含 LaTeX 公式（如 `$(1-3i)^2=$`）导致 content.length >100
- **AND** 题目有选项模式（`A.`/`B.`/`C.`/`D.`）
- **THEN** 系统 SHALL 识别为 `single_choice`，而非因长度超过阈值误判为 `essay`

#### Scenario: 自动识别分值

- **WHEN** 试卷中标注了各题分值
- **THEN** 系统提取并关联到对应的试题

#### Scenario: 手动修正结构

- **WHEN** 用户发现解析错误并进行修正
- **THEN** 系统更新试卷结构并保存修正结果

#### Scenario: 手动修正题型

- **WHEN** 教师在编辑校准页面（PaperEdit 或 SplitPreview）发现某题题型识别错误
- **THEN** 教师可通过题型下拉框手动修正题型（single_choice/multiple_choice/fill/essay/unknown）并保存
- **AND** 修正后的题型保存到数据库 Question.questionType 字段

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
