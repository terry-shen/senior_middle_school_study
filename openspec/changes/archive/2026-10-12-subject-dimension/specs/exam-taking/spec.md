## ADDED Requirements

### Requirement: 学生端学科筛选

系统 SHALL 在学生端支持按学科筛选考试和错题。

#### Scenario: 学生按学科查看考试

- **WHEN** 学生在学科切换器中选择某学科
- **THEN** 考试列表刷新为该学科的考试
- **AND** 其他学科的考试不显示

#### Scenario: 学生学科切换器默认行为

- **WHEN** 学生首次登录
- **THEN** 学科切换器默认选中「数学」（或上次选择的学科，从 localStorage 恢复）
- **AND** 学生端切换器不显示「全部学科」选项（仅管理员可看全部）
