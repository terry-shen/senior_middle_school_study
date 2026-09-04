## ADDED Requirements

### Requirement: 知识点文档管理

系统 SHALL 支持以"文档"为单位的知识点体系管理。每个 KnowledgePoint 记录代表一份独立的知识点参考文档（如"高一数学上学期教学大纲"、"函数与导数章节知识点"），存储为 Markdown 富文本内容，不强制树形层级结构。

#### Scenario: 创建知识点文档

- **WHEN** 管理员点击"新建知识点文档"并指定标题
- **THEN** 系统创建新的 KnowledgePoint 记录（contentMarkdown 为空），进入富文本编辑器

#### Scenario: 查询知识点文档列表

- **WHEN** 用户访问"知识点"页面
- **THEN** 系统返回所有知识点文档的列表，每条记录显示 id、title、createdAt、updatedAt，按 updatedAt 倒序排列

#### Scenario: 在线编辑知识点文档

- **WHEN** 管理员点击某文档进入编辑
- **THEN** 系统展示双栏富文本编辑器（复用 PaperEdit 组件）：左侧 Markdown 源码编辑（支持 MathLive 公式插入、答案标记、解析标记、图片插入），右侧 MathText 实时预览（KaTeX 渲染、图片渲染）

#### Scenario: 学生只读浏览

- **WHEN** 学生点击某知识点文档
- **THEN** 系统以只读模式展示文档内容（MathText 渲染数学公式和图片），不显示编辑按钮

#### Scenario: 删除知识点文档

- **WHEN** 管理员点击某文档的"删除"并确认
- **THEN** 系统删除该 KnowledgePoint 记录及其 contentMarkdown 内容，不可恢复

## REMOVED Requirements

### Requirement: 知识点体系结构管理

**Reason**: 原 requirement 基于树形层级结构（多层级知识点树），已替换为文档级管理。每个 KnowledgePoint 记录从"树节点"变为"独立文档"，不再有 parentId/level/code 字段的使用。

**Migration**: 使用新的"知识点文档管理"requirement。管理员通过文档列表+编辑器管理知识点，学生通过文档浏览查看。

### Requirement: 知识点学习要求定义

**Reason**: 知识点降级为参考文档，不再为每个知识点节点定义掌握程度（了解/理解/掌握/熟练应用）和建议学习时长。这些字段原本服务于掌握度评估，现已废弃。

**Migration**: 教师在 Word 文档中可在描述中自然提及学习要求（如"本节要求熟练掌握"），系统不结构化存储 masteryLevel/suggestedHours 字段。

### Requirement: 知识点关联关系

**Reason**: 前置依赖关系原本服务于学习路径规划，现已废弃学习路径模块。知识点文档之间不再有结构化的依赖关系。

**Migration**: 教师可在文档内容中自然描述章节顺序和依赖（如"本章需要先学习函数基础"），系统不存储 KnowledgePointRelation 表。
