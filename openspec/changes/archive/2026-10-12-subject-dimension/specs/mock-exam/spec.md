## ADDED Requirements

### Requirement: 考试学科维度

系统 SHALL 为每个考试会话（ExamSession）关联一个学科（subjectId）。考试列表支持按学科筛选。

#### Scenario: 创建考试时指定学科

- **WHEN** 管理员创建考试会话（手动/自动组卷/整卷）
- **THEN** ExamSession 记录写入 subjectId（自动组卷从出卷参数取，整卷从试卷取，手动从切换器取）

#### Scenario: 考试列表按学科筛选

- **WHEN** 前端请求 GET /api/exam-sessions?subjectId=2
- **THEN** 返回 subjectId=2 的考试列表

#### Scenario: 学生考试列表按学科筛选

- **WHEN** 学生前端请求 GET /api/exam-sessions/student/all（带当前 subjectId）
- **THEN** 返回该学生被分配的、subjectId 匹配的考试列表
