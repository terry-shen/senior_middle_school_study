## ADDED Requirements

### Requirement: 全局学科切换器

系统 SHALL 在顶栏提供全局学科切换器，管理员和学生均可使用。选择学科后存入 localStorage 并通过 React Context 共享，所有前端 API 请求隐式携带当前 subjectId 查询参数，后端按 subjectId 过滤返回数据。

#### Scenario: 顶栏学科切换器

- **WHEN** 用户登录后进入任意页面
- **THEN** 顶栏右侧显示学科切换下拉，默认选中「数学」（或上次选择的学科）
- **AND** 下拉列表来自 GET /api/subjects（仅 isActive=true 的学科）

#### Scenario: 切换学科持久化

- **WHEN** 用户选择某学科
- **THEN** 选择值存入 localStorage 键 `selectedSubjectId`
- **AND** React Context 更新，触发依赖 subjectId 的 API 重新请求
- **AND** 下次登录自动恢复上次选择的学科

#### Scenario: API 隐式携带 subjectId

- **WHEN** 前端发起任何业务数据列表请求（papers/questions/exam-sessions/wrong-questions/knowledge-points 等）
- **THEN** 请求 URL 自动附带 `?subjectId=<当前学科ID>` 查询参数
- **AND** 后端按 subjectId 过滤返回数据，不返回其他学科的记录

#### Scenario: 学科切换器「全部」选项

- **WHEN** 用户在切换器中选择「全部学科」
- **THEN** API 请求不带 subjectId 参数
- **AND** 后端返回所有学科的数据（管理员视角，学生默认不显示此选项）

### Requirement: 学科管理界面

系统 SHALL 在系统设置分组下提供学科管理界面，管理员可 CRUD 学科。

#### Scenario: 进入学科管理

- **WHEN** 管理员点击侧边栏「系统设置」→「学科管理」
- **THEN** 导航到 /subjects 管理页面，显示学科列表表格

#### Scenario: 学科列表

- **WHEN** 管理员进入学科管理页面
- **THEN** 表格显示学科 code/name/icon/color/order/isActive，按 order 排序
- **AND** 每行有编辑/启停按钮
