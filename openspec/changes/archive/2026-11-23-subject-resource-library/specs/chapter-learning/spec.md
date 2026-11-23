## MODIFIED Requirements

### Requirement: 学科学习导航

章节学习页 SHALL 在顶部以学科 Tab 条列出全部启用学科，并按学科是否有教材小节、视频课程或未映射教辅资源区分「可学习」与「待建设」。

#### Scenario: 列出全部学科

- **WHEN** 用户进入 /learning
- **THEN** 顶部显示学科 Tab 条，按 Subject.order 排列，每项显示学科图标、名称与小节数
- **AND** 数据来自 GET /api/learning/subjects，返回 `{id, code, name, icon, color, sectionCount, videoCount, resourceCount}`

#### Scenario: 可学习学科

- **WHEN** 某学科的 sectionCount、videoCount 或 resourceCount 任一大于 0
- **THEN** 该 Tab 使用学科自身颜色着色且可点击
- **AND** 点击后加载该学科的视频主线课程与教辅资源分类

#### Scenario: 待建设学科

- **WHEN** 某学科的 sectionCount、videoCount、resourceCount 全部为 0
- **THEN** 该 Tab 灰显并标注「待建设」，不可点击
- **AND** 不发起该学科的课程请求

#### Scenario: 记住上次选择

- **WHEN** 用户选择某学科 Tab
- **THEN** 选择写入 localStorage（`selectedSubjectId`）
- **AND** 下次进入页面自动恢复；无记录时默认选中第一个可学习的学科

#### Scenario: 教辅资源分类

- **WHEN** 学生进入有未映射资源的学科
- **THEN** 页面在「视频主线课程」之外显示并列的「教辅资源」分类
- **AND** 「教辅资源」只展示该学科未映射、学生可见的资源
