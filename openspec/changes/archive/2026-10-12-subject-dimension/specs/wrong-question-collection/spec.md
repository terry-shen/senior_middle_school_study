## ADDED Requirements

### Requirement: 错题学科维度

系统 SHALL 为每条错题（StudentWrongQuestion）关联一个学科（subjectId）。学生录入错题时可选择学科。错题本支持按学科筛选。

#### Scenario: 录入错题时选择学科

- **WHEN** 学生拍照或手动录入错题
- **THEN** 录入表单包含学科选择下拉（默认当前切换器选中的学科）
- **AND** 保存时写入 subjectId

#### Scenario: 错题本按学科筛选

- **WHEN** 学生在错题本页面查看
- **THEN** 仅显示当前学科切换器选中的学科的错题
- **AND** 切换学科时错题列表刷新
