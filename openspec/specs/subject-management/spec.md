# subject-management Specification

## Purpose
提供可管理的学科字典表，支持按学科维度组织试卷、题目、考试、错题、知识点等业务数据，并通过全局学科切换器实现学科筛选。

## Requirements

### Requirement: 只读学科目录

系统 SHALL 提供只读的学科目录接口，供章节学习页与工作台展示学科列表与建设状态。

#### Scenario: 学科目录接口

- **WHEN** 前端调用 GET /api/learning/subjects
- **THEN** 返回启用学科（isActive=true，按 order 排序）
- **AND** 每条包含 `{id, code, name, icon, color, sectionCount}`
- **AND** sectionCount 为该校教材下的小节总数

#### Scenario: 学科筛选能力

- **WHEN** 前端调用 GET /api/subjects
- **THEN** 仍返回学科列表（兼容保留，只读）
- **AND** 不再提供 POST/PUT/DELETE 学科接口

#### Scenario: 建设状态判定

- **WHEN** 某学科 sectionCount = 0
- **THEN** 前端将其标记为「待建设」并禁止进入
- **AND** 不影响其它学科使用
