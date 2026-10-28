## ADDED Requirements

### Requirement: 导入知识点学科选择

系统 SHALL 在导入 Word 文档知识点时要求选择学科。

#### Scenario: 导入时学科选择

- **WHEN** 管理员在知识点导入页面上传 Word 文档
- **THEN** 导入表单包含学科选择下拉（默认当前切换器选中的学科）
- **AND** 导入完成后创建的 KnowledgePoint 记录写入所选 subjectId
