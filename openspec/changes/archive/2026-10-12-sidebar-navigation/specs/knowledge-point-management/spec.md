## MODIFIED Requirements

### Requirement: 知识点文档管理

系统 SHALL 支持以"文档"为单位的知识点体系管理。每个 KnowledgePoint 记录代表一份独立的知识点参考文档（如"高一数学上学期教学大纲"、"函数与导数章节知识点"），存储为 Markdown 富文本内容，不强制树形层级结构。列表页工具栏 SHALL 提供「导入 Word 文档」按钮，作为知识点导入的唯一入口（不再作为独立导航项）。

#### Scenario: 创建知识点文档

- **WHEN** 管理员点击"新建知识点文档"并指定标题
- **THEN** 系统创建新的 KnowledgePoint 记录（contentMarkdown 为空），进入富文本编辑器

#### Scenario: 查询知识点文档列表

- **WHEN** 用户访问"知识点"页面
- **THEN** 系统返回所有知识点文档的列表，每条记录显示 id、title、createdAt、updatedAt，按 updatedAt 倒序排列
- **AND** 列表页工具栏显示「新建文档」和「导入 Word 文档」两个按钮

#### Scenario: 从列表页工具栏导入 Word 文档

- **WHEN** 管理员在知识点列表页点击工具栏「导入 Word 文档」按钮
- **THEN** 导航到 /knowledge-points/import 页面（既有导入流程）
- **AND** 导入流程保持不变（上传 .docx → mammoth 转 Markdown → 富文本编辑器校准 → 保存）

#### Scenario: 在线编辑知识点文档

- **WHEN** 管理员点击某文档进入编辑
- **THEN** 系统展示双栏富文本编辑器（复用 PaperEdit 组件）：左侧 Markdown 源码编辑（支持 MathLive 公式插入、答案标记、解析标记、图片插入），右侧 MathText 实时预览（KaTeX 渲染、图片渲染）

#### Scenario: 学生只读浏览

- **WHEN** 学生点击某知识点文档
- **THEN** 系统以只读模式展示文档内容（MathText 渲染数学公式和图片），不显示编辑按钮

#### Scenario: 删除知识点文档

- **WHEN** 管理员点击某文档的"删除"并确认
- **THEN** 系统删除该 KnowledgePoint 记录及其 contentMarkdown 内容，不可恢复
