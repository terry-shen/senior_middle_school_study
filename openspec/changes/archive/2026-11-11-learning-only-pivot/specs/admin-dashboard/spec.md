## REMOVED Requirements

### Requirement: 试题管理界面
**Reason**: 题库/试卷/试题能力整体下线。
**Migration**: 无（历史数据先备份后删除）。

### Requirement: 学生反馈处理界面
**Reason**: 反馈功能 v2 未实现且无数据来源。
**Migration**: 无。

### Requirement: 系统配置界面
**Reason**: LLM 模型管理与推荐算法配置随能力下线。
**Migration**: 无（LLMConfig 表保留，不再提供界面）。

### Requirement: 数据统计界面
**Reason**: 试题/掌握度统计依赖已删除的数据表。
**Migration**: 工作台保留资源与章节维度的轻量统计。

### Requirement: 学生错题本只读视图
**Reason**: 错题本能力下线。
**Migration**: 无。

### Requirement: 全局学科切换器
**Reason**: 学科选择改为章节学习页内的学科 Tab，不再需要全局切换器与隐式 subjectId 注入。
**Migration**: 由 chapter-learning「学科学习导航」取代。

### Requirement: 学科管理界面
**Reason**: 学科 CRUD 页面删除，学科目录仅只读。
**Migration**: 由 subject-management「只读学科目录」取代。

### Requirement: 管理员导航菜单分组
**Reason**: 原分组包含试卷/题目/考试/激励/学科管理/模型管理，均已下线。
**Migration**: 由新增「管理员导航菜单分组（学习主线）」取代。

### Requirement: 工作台首页
**Reason**: 原工作台按试卷/答题纸统计，数据源消失。
**Migration**: 由新增「工作台首页（学习主线）」取代。

## ADDED Requirements

### Requirement: 管理员导航菜单分组（学习主线）

管理员侧边栏 SHALL 收敛为学习主线相关的分组与入口。

#### Scenario: 桌面端侧边栏布局

- **WHEN** 管理员在桌面端（宽度 >768px）登录后进入任意页面
- **THEN** 左侧固定显示 220px 侧边栏，当前路由高亮
- **AND** 主内容区占据剩余宽度

#### Scenario: 导航分组与入口

- **WHEN** 管理员查看侧边栏
- **THEN** 显示分组：
  - 学习内容：章节学习（/learning）、章节管理（/chapters）、资源映射（/netdisk-index）、学习资源（/resources）
  - 学生管理：学生列表（/students）
  - 系统设置：网盘绑定（/settings/netdisk）
- **AND** 不显示试卷库、题库管理、题目列表、模拟考试、答题纸阅卷、学习激励、学科管理、模型管理

#### Scenario: 移动端抽屉

- **WHEN** 管理员在移动端（≤768px）访问
- **THEN** 侧边栏默认隐藏，点击汉堡按钮以抽屉方式滑出
- **AND** 点击遮罩或选择入口后自动收起

#### Scenario: 学生侧边栏

- **WHEN** 学生登录
- **THEN** 侧边栏显示「工作台」「章节学习」「学习资源」「AI 助理」
- **AND** 顶部不显示学科切换器

### Requirement: 工作台首页（学习主线）

系统首页 SHALL 按角色展示不同内容，均围绕章节学习。

#### Scenario: 管理员工作台

- **WHEN** 管理员访问 /
- **THEN** 显示统计卡片：教材册数、章节数、小节数、已索引资源数、有资源小节数
- **AND** 数据来自 /api/chapters/tree 与 /api/netdisk-index/stats

#### Scenario: 学生工作台

- **WHEN** 学生访问 /
- **THEN** 显示「继续学习」「我的学科」「最近打开」三块
- **AND** 数据来自 /api/learning/progress、/api/learning/subjects、/api/learning/recent

#### Scenario: 数据加载失败

- **WHEN** 任一统计接口失败
- **THEN** 对应区域显示「--」或空态，不影响其它区域
