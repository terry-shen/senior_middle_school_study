## ADDED Requirements

### Requirement: 试卷学科关联

系统 SHALL 为每份试卷（ExamPaper）关联一个学科（subjectId）。导入试卷时 SHALL 选择或自动识别学科。试卷列表支持按学科筛选。

#### Scenario: 导入时选择学科

- **WHEN** 管理员导入试卷（整卷或拆分导入）
- **THEN** 导入表单包含学科选择下拉（默认数学，可修改）
- **AND** 自动提取的学科（从文件名/内容识别）作为预选值，管理员可覆盖

#### Scenario: ExamPaper.subject 字段迁移

- **WHEN** 执行数据库迁移脚本
- **THEN** 现有 ExamPaper.subject String? 字段值（如"理综"/"数学"）映射到 Subject.code 查 ID
- **AND** 写入新的 subjectId Int? 外键字段
- **AND** 删除旧的 subject String? 字段
- **AND** 无法映射的记录 subjectId 设为数学 ID（兜底）

#### Scenario: 试卷列表按学科筛选

- **WHEN** 前端请求 GET /api/papers?subjectId=2
- **THEN** 返回 subjectId=2 的试卷列表，不返回其他学科的试卷

#### Scenario: 整卷导入学科自动识别

- **WHEN** 管理员导入整卷文件（如"2026年高考理综陕西卷.docx"）
- **THEN** paper-metadata-service 从文件名/内容识别学科（理综→science）
- **AND** 识别结果写入 subjectId 字段，管理员可在元数据编辑中覆盖
