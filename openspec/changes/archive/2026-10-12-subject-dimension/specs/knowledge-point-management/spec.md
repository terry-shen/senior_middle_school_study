## ADDED Requirements

### Requirement: 知识点学科维度

系统 SHALL 为每份知识点文档（KnowledgePoint）关联一个学科（subjectId）。知识点列表支持按学科筛选。

#### Scenario: 创建/导入知识点时选择学科

- **WHEN** 管理员新建知识点文档或导入 Word 文档
- **THEN** 表单包含学科选择下拉（默认当前切换器选中的学科）
- **AND** 保存时写入 subjectId

#### Scenario: 知识点列表按学科筛选

- **WHEN** 前端请求 GET /api/knowledge-points?subjectId=2
- **THEN** 返回 subjectId=2 的知识点文档列表

#### Scenario: 旧数据迁移

- **WHEN** 执行数据库迁移脚本
- **THEN** 所有 subjectId 为 null 的知识点设为数学学科 ID
