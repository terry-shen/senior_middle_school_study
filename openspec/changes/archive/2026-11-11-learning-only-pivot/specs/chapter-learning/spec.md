## REMOVED Requirements

### Requirement: 我的学习工作台
**Reason**: 首页改为「学习工作台」，不再包含待做试卷与错题提醒（试卷/错题能力已下线）。
**Migration**: 由新增的「学习工作台」requirement 取代。

### Requirement: 数学章节地图
**Reason**: 章节地图改为由「学科学习导航」驱动的视频主线课程视图，不再按教材册/章/节展开，也不再限定数学。
**Migration**: 由新增的「学科学习导航」与既有「视频主线课程」取代。

### Requirement: 学生端导航仅保留章节化入口
**Reason**: 学生导航收敛为「章节学习 / 学习资源 / AI 助理」，原列表中的「我的试卷」「错题本」「学习激励」已随能力下线。
**Migration**: 由新增的「学生端导航」requirement 取代。

## ADDED Requirements
### Requirement: 学科学习导航

章节学习页 SHALL 在顶部以学科 Tab 条列出全部启用学科，并按学科是否有教材小节区分「可学习」与「待建设」。

#### Scenario: 列出全部学科

- **WHEN** 用户进入 /learning
- **THEN** 顶部显示学科 Tab 条，按 Subject.order 排列，每项显示学科图标、名称与该学科小节数
- **AND** 数据来自 GET /api/learning/subjects，返回 `{id, code, name, icon, color, sectionCount}`

#### Scenario: 可学习学科

- **WHEN** 某学科 sectionCount > 0
- **THEN** 该 Tab 使用学科自身颜色（Subject.color）着色且可点击
- **AND** 点击后加载该学科的视频主线课程与关联教材小节

#### Scenario: 待建设学科

- **WHEN** 某学科 sectionCount = 0
- **THEN** 该 Tab 灰显并标注「待建设」，不可点击
- **AND** 不发起该学科的课程请求

#### Scenario: 记住上次选择

- **WHEN** 用户选择某学科 Tab
- **THEN** 选择写入 localStorage（`selectedSubjectId`）
- **AND** 下次进入页面自动恢复；无记录时默认选中第一个有教材小节的学科（数学）

### Requirement: 学习工作台

学生首页 SHALL 是以学习为导向的工作台，展示继续学习、我的学科与最近打开。

#### Scenario: 继续学习

- **WHEN** 学生曾打开过某节资源
- **THEN** 顶部显示「继续学习：<册> <章> <节>」与「继续」按钮
- **AND** 点击直接进入该节详情页

#### Scenario: 无学习记录

- **WHEN** 学生从未打开过任何章节
- **THEN** 显示「从章节学习开始」引导入口
- **AND** 不显示空的继续学习卡片

#### Scenario: 我的学科

- **WHEN** 学生进入工作台
- **THEN** 显示有教材小节的学科卡片（数学 / 物理 / 化学 / 生物），每张显示学科名、小节总数
- **AND** 点击卡片进入 /learning 并选中该学科

#### Scenario: 最近打开

- **WHEN** 学生打开过资源
- **THEN** 显示最近 5 条打开记录（资源名 + 所属小节 + 时间）
- **AND** 点击可回到对应小节

### Requirement: 学生端导航

学生侧边栏 SHALL 仅保留学习相关内容：章节学习、学习资源、AI 助理。

#### Scenario: 学生侧边栏内容
- **WHEN** 学生登录后查看侧边栏
- **THEN** 显示「工作台」「章节学习」「学习资源」「AI 助理」
- **AND** 不显示试卷库、题库管理、题目列表、模拟考试、答题纸阅卷、错题本、学习激励、模型管理

#### Scenario: 学生直接访问已下线路径
- **WHEN** 学生直接输入 /paper-library、/question-bank、/mock-exams、/answer-sheets、/wrong-questions、/incentive 等已下线路径
- **THEN** 系统重定向到 /learning
- **AND** 不请求任何已下线接口

## MODIFIED Requirements

### Requirement: 章节详情页

系统 SHALL 为每个 Section 提供详情页，聚合该节的精选视频、讲义、练习资源。

#### Scenario: 精选资源分组展示
- **WHEN** 学生打开某节详情页
- **THEN** 页面按视频 / 讲义 / 练习 / 试卷资料四组展示已确认的精选资源
- **AND** 每组最多展示 5 条，超出部分折叠在「更多资源」

#### Scenario: 空章节
- **WHEN** 该节没有任何已确认精选资源
- **THEN** 页面自动展开「更多资源」并给出「本节资源正在整理中」提示
- **AND** 不再展示试卷或错题入口

#### Scenario: 展开更多资源
- **WHEN** 学生点击「更多资源」
- **THEN** 展开该节全部学生侧可见资源并按类型分段
- **AND** 学生可直接点击任意资源打开阅读器
