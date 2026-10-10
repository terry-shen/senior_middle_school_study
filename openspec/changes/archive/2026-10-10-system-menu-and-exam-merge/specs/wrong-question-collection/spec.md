# wrong-question-collection Delta

## MODIFIED Requirements

### Requirement: 管理员只读访问学生错题本

管理员 SHALL 能通过专用端点查看任意学生的错题本内容（只读），用于了解学生学习情况。学生端 API 不受影响。

#### Scenario: 管理员查询学生错题列表
- **WHEN** 管理员调用 GET /api/wrong-questions/student/:studentId?viewMode=all
- **THEN** 返回该学生的全部错题列表（含已掌握）
- **AND** requireAdmin 中间件校验权限
- **AND** 不返回其他学生的数据

#### Scenario: 管理员查询学生掌握度概览
- **WHEN** 管理员调用 GET /api/wrong-questions/student/:studentId/mastery-overview
- **THEN** 返回该学生的掌握度概览（总体+按标签分组）
- **AND** 数据结构与学生自查一致

#### Scenario: 管理员无法修改学生错题
- **WHEN** 管理员尝试调用 POST/PUT/DELETE /api/wrong-questions/student/:studentId/*
- **THEN** 返回 403 禁止（管理员只读）
- **AND** 学生端 POST/PUT/DELETE /api/wrong-questions/* 不受影响

#### Scenario: 前端只读视图
- **WHEN** 管理员导航到 /admin/students/:studentId/wrong-questions
- **THEN** 显示错题卡片列表 + 掌握度概览
- **AND** 不显示「拍照录入」「手动录入」「重练」「编辑」「删除」按钮
- **AND** 显示「返回学生列表」按钮
