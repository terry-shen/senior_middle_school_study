# exam-paper-import Specification

## Purpose
提供考卷的导入、逐题解析拆分与结构化存储能力，支持PDF和图片格式（包括手机拍照），自动识别每道题目并拆分为独立试题，为题库管理和后续分析提供原始数据。

## Requirements

### Requirement: 多格式试卷导入
系统 SHALL 支持导入PDF、图片、Word文档（.docx/.doc）和纯文本（.txt）格式的考卷文件，包括手机拍照上传。

#### Scenario: 导入PDF试卷
- **WHEN** 用户上传PDF格式的考卷文件
- **THEN** 系统解析文件并创建试卷记录，显示导入进度和结果

#### Scenario: 导入图片试卷（手机拍照）
- **WHEN** 用户上传图片格式的考卷文件（手机拍照）
- **THEN** 系统使用OCR技术识别内容并创建试卷记录

#### Scenario: 批量图片导入
- **WHEN** 用户上传多张图片（试卷分页拍照）
- **THEN** 系统合并识别内容并创建完整的试卷记录

#### Scenario: 导入Word文档试卷
- **WHEN** 用户上传Word文档（.docx）格式的考卷文件
- **THEN** 系统解析文档内容（段落、表格、嵌入图片），提取文本并创建试卷记录

#### Scenario: 导入旧版Word文档试卷
- **WHEN** 用户上传旧版Word文档（.doc）格式的考卷文件
- **THEN** 系统提取文档文本内容并创建试卷记录

#### Scenario: 导入纯文本试卷
- **WHEN** 用户上传纯文本（.txt）格式的考卷文件
- **THEN** 系统自动检测文件编码（UTF-8/GBK），读取文本内容并创建试卷记录

#### Scenario: 自动路由解析器
- **WHEN** 用户上传任意支持格式的文件
- **THEN** 系统根据文件扩展名自动选择对应的解析服务（PDF解析/OCR/Word解析/文本读取），对用户透明

#### Scenario: 不支持的文件格式
- **WHEN** 用户上传不在支持列表中的文件格式（如.xlsx、.pptx）
- **THEN** 系统拒绝导入并提示用户支持的文件格式列表

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

### Requirement: 题目图片处理
系统 SHALL 支持试题中包含数学公式、图形等图片内容。

#### Scenario: 提取题目图片
- **WHEN** 试卷中的题目包含图形或公式图片
- **THEN** 系统提取图片并关联到对应的试题

#### Scenario: 图片格式转换
- **WHEN** 提取的图片格式不利于存储或展示
- **THEN** 系统转换为标准格式（PNG/JPEG）

### Requirement: 试卷元数据管理
系统 SHALL 存储试卷的基本信息，包括来源、年份、地区、考试类型、学科、学校等。学科 SHALL 使用枚举（语文/数学/英语/物理/化学/生物/政治/历史/地理/理综/文综/其他），学校为自由文本。系统 SHALL 在导入时从文件名和内容自动提取学科关键字。整卷（purpose=whole_paper）的导入入口 SHALL 位于试卷库功能区，拆分来源（purpose=question_source）的导入入口 SHALL 位于题库管理页面。

#### Scenario: 添加试卷元数据
- **WHEN** 用户填写试卷的元数据信息
- **THEN** 系统保存元数据并支持后续检索

#### Scenario: 按条件检索试卷
- **WHEN** 用户按学科、年份、地区或考试类型筛选试卷
- **THEN** 系统返回符合条件的试卷列表

#### Scenario: 自动提取学科
- **WHEN** 系统导入文件名为"2010年高考数学陕西卷.doc"的试卷
- **THEN** 系统从文件名识别"数学"关键字并自动填充 subject=数学
- **AND** 同时提取 year/region/examType/totalScore/duration

#### Scenario: 手动补充学校信息
- **WHEN** 管理员在试卷库或题库管理列表点击"编辑元数据"
- **THEN** 系统弹出元数据编辑表单，包含 title/subject/year/region/examType/school/totalScore/duration 字段
- **AND** 学校字段为自由文本输入，保存后持久化到 ExamPaper.school

#### Scenario: 整卷导入入口位于试卷库
- **WHEN** 管理员在试卷库功能区查找整卷导入入口
- **THEN** 系统提供单文件整卷导入和文件夹递归整卷导入两个入口
- **AND** 题库管理页面 SHALL NOT 显示整卷导入入口

#### Scenario: 拆分来源导入入口位于题库管理
- **WHEN** 管理员在题库管理页面查找拆分导入入口
- **THEN** 系统提供拆分导入入口（MinerU 解析+编辑校准+拆分入库）
- **AND** 试卷库页面 SHALL NOT 显示拆分导入入口

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

### Requirement: 导入来源格式标识
系统 SHALL 在试卷记录中标识导入来源的文件格式，便于后续追溯和统计。

#### Scenario: 记录来源格式
- **WHEN** 系统成功导入一份试卷
- **THEN** 系统在试卷记录的 `sourceFormat` 字段中存储格式类型（pdf/image/word/txt）

#### Scenario: 按来源格式筛选
- **WHEN** 管理员按导入格式筛选试卷列表
- **THEN** 系统返回匹配该格式的试卷记录列表

### Requirement: 源文件保留与下载
系统 SHALL 永久保留导入的原始文件（PDF/DOCX/TXT等），并提供下载入口供用户对比富文本内容与源文档是否一致。

#### Scenario: 源文件保留
- **WHEN** 用户通过前端上传文件导入试卷
- **THEN** 系统将原始文件永久保留在 uploads/papers/ 目录，不因重新拆分或编辑而删除
- **AND** 试卷记录的 pdfUrl 字段存储源文件访问路径

#### Scenario: 编辑器中下载源文件
- **WHEN** 用户在编辑器页面查看Markdown内容时需要对比源文档
- **THEN** 编辑器顶部 SHALL 提供"下载源文件"按钮，点击后下载或在新窗口打开原始文件

#### Scenario: 试卷列表中下载源文件
- **WHEN** 管理员在试卷列表页面查看试卷
- **THEN** 每份试卷的操作列 SHALL 提供"下载源文件"按钮（仅当源文件存在时显示）
