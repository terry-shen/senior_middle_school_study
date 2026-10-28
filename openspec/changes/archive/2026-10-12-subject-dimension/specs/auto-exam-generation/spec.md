## ADDED Requirements

### Requirement: 出卷学科强制过滤

系统 SHALL 在自动组卷时强制按 subjectId 过滤题目，杜绝跨学科混卷。

#### Scenario: 自动组卷按学科选题

- **WHEN** 管理员调用 POST /api/exams/preview 或 /generate 并指定 subjectId
- **THEN** selectQuestions 仅从 subjectId 匹配的题目池中选题
- **AND** 不返回其他学科的题目

#### Scenario: 未指定学科时兜底

- **WHEN** 自动组卷请求未携带 subjectId
- **THEN** 系统使用当前学科切换器的 subjectId（从请求头或 query 参数读取）
- **AND** 若仍无 subjectId，返回 400 错误"请先选择学科"

#### Scenario: 出卷预览显示学科

- **WHEN** 出卷预览结果返回
- **THEN** 预览数据包含 subjectId 和学科名称
- **AND** 生成的 ExamSession 记录写入 subjectId
