# knowledge-point-import Specification

## Purpose
提供基于 Word 文档的知识点导入功能，教师上传教学大纲或章节目录的 Word 文档，系统转换为 Markdown 后进入在线富文本编辑器校准，不依赖大模型或 Excel 模板。

## Requirements

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
