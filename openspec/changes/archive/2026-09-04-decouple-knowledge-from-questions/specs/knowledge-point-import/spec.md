## ADDED Requirements

### Requirement: Word文档导入知识点

系统 SHALL 提供基于 Word 文档（.docx/.doc）的知识点导入功能，支持教师上传已有教学大纲、章节目录等 Word 文档，系统使用 mammoth 转 Markdown 后进入在线富文本编辑器进行校准。导入流程不依赖大模型，不使用 Excel 模板。

#### Scenario: 上传 Word 文档并转换为 Markdown

- **WHEN** 用户在知识点导入页面选择 .docx 或 .doc 文件并点击"上传"
- **THEN** 系统使用 mammoth 库将 Word 文档转换为 Markdown 文本，进入在线富文本编辑器

#### Scenario: 在线富文本编辑校准

- **WHEN** 文档转换完成进入编辑器
- **THEN** 系统展示双栏编辑界面：左侧为 Markdown 源码编辑器（支持 MathLive 公式插入、题目标签、答案标记、解析标记、图片插入），右侧为 MathText 实时预览（KaTeX 渲染数学公式、图片渲染）

#### Scenario: 保存编辑后的知识点文档

- **WHEN** 用户在编辑器中完成校准并点击"保存"
- **THEN** 系统将编辑后的 Markdown 内容存入 KnowledgePoint 表的 contentMarkdown 字段，title 取自上传文件名（去扩展名）

#### Scenario: 不支持的文件格式

- **WHEN** 用户上传非 .docx/.doc 格式文件（如 PDF、TXT、XLSX）
- **THEN** 系统返回 400 错误，提示"仅支持 .docx/.doc 格式的 Word 文档，请将内容整理为 Word 文档后上传"

#### Scenario: 空文件或解析失败

- **WHEN** 上传的 Word 文档为空或 mammoth 解析失败
- **THEN** 系统返回错误提示"Word 文档解析失败，请检查文件内容后重新上传"

#### Scenario: 从 PDF 导入知识点

- **WHEN** 管理员上传 PDF 文件尝试导入知识点
- **THEN** 系统提示"已切换为 Word 文档导入方式，PDF 文件不支持直接导入，请将内容复制到 Word 文档后上传"

#### Scenario: 从图片导入知识点

- **WHEN** 管理员上传图片文件（如思维导图、知识图谱）
- **THEN** 系统提示"已切换为 Word 文档导入方式，图片不支持直接导入，请将内容整理为 Word 文档后上传"

#### Scenario: 手动新建知识点文档

- **WHEN** 管理员需要手动创建知识点文档（无 Word 源文件）
- **THEN** 系统提供"新建文档"入口，进入空白富文本编辑器，用户可直接输入内容并保存

## REMOVED Requirements

### Requirement: 多渠道知识点导入

**Reason**: 原 requirement 基于 Excel 模板（5层树形结构），已完全替换为 Word 文档导入方式。Excel 模板下载、表头结构、Excel 解析、留空规则、层级一致性校验等场景均不再适用。

**Migration**: 使用新的"Word文档导入知识点"requirement。教师将知识点内容整理到 Word 文档中上传，系统自动转 Markdown 并进入编辑器校准。

### Requirement: 知识点自动分类与映射

**Reason**: 知识点降级为独立参考文档，不再需要树形层级结构和 code 自动生成。Excel 列位置→树形结构的映射逻辑随 Excel 模板一同废弃。

**Migration**: 教师在 Word 文档中自由组织内容结构（标题层级、列表、段落），系统不强制结构化解析。学生通过 MathText 渲染查看文档原文。

### Requirement: 增量导入与冲突检测

**Reason**: Word 文档导入是"文档级"操作而非"节点级"操作，每份文档独立存在，不存在 code 匹配和增量更新的概念。文档的更新通过编辑器直接修改 contentMarkdown 字段实现。

**Migration**: 文档更新流程改为：在文档列表中选择文档 → 进入编辑器 → 修改内容 → 保存。无需 code 匹配、新建/更新统计、冲突检测。

### Requirement: 人工编辑校准

**Reason**: 校准功能已合并到"Word文档导入知识点"requirement 中——上传后直接进入富文本编辑器校准，不再是独立的"上传→预览→编辑→确认"三步流程。

**Migration**: 上传 Word 文档即进入编辑器，编辑即校准，保存即入库。流程从三步简化为两步。

### Requirement: 知识点导入预览

**Reason**: Excel 时代的"树形预览+批量编辑"不再适用。Word 文档导入后直接进入富文本编辑器所见即所得，无需独立的预览界面。

**Migration**: 编辑器的右侧 MathText 实时预览即替代独立的预览步骤。

### Requirement: 知识点导入历史

**Reason**: 系统简化为文档管理，每份文档有 createdAt/updatedAt 字段可追溯，无需独立的"导入历史"模块。文档列表页即替代导入历史。

**Migration**: 文档列表展示创建时间、最后修改时间、文件名，支持按时间排序，提供文档级删除（不回滚单次导入）。
