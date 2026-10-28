## ADDED Requirements

### Requirement: 试题学科维度

系统 SHALL 为每道题目（Question）关联一个学科（subjectId）。题目继承所属试卷的学科。题库管理支持按学科筛选。

#### Scenario: 题目继承试卷学科

- **WHEN** 试卷拆分生成题目记录
- **THEN** 每道题目的 subjectId 自动继承所属试卷（ExamPaper）的 subjectId
- **AND** 若试卷无 subjectId，题目 subjectId 为 null（旧数据兜底为数学）

#### Scenario: 题库按学科筛选

- **WHEN** 前端请求 GET /api/papers/questions/all?subjectId=2
- **THEN** 返回 subjectId=2 的题目列表，不返回其他学科的题目

#### Scenario: 旧数据迁移

- **WHEN** 执行数据库迁移脚本
- **THEN** 所有 subjectId 为 null 的题目设为数学学科 ID
