## REMOVED Requirements

### Requirement: 学科字典管理
**Reason**: 学科管理页与学科 CRUD 接口删除；学科由种子脚本维护，界面只读。
**Migration**: 由新增「只读学科目录」取代；需要改学科请修改 `seed-subjects.cjs` 后重跑。

## ADDED Requirements

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
