## MODIFIED Requirements

### Requirement: 管理员导航菜单分组（学习主线）

管理员侧边栏 SHALL 收敛为学习主线相关的分组与入口，并在学生管理组下提供学习行为分析入口。

#### Scenario: 桌面端侧边栏布局

- **WHEN** 管理员在桌面端（宽度 >768px）登录后进入任意页面
- **THEN** 左侧固定显示 220px 侧边栏，当前路由高亮
- **AND** 主内容区占据剩余宽度

#### Scenario: 导航分组与入口

- **WHEN** 管理员查看侧边栏
- **THEN** 显示分组：
  - 学习内容：章节学习（/learning）、章节管理（/chapters）、资源映射（/netdisk-index）、学习资源（/resources）
  - 学生管理：学生列表（/students）、学习分析（/analytics）
  - 系统设置：网盘绑定（/settings/netdisk）、AI 助理（/ai-assistants）
- **AND** 不显示试卷库、题库管理、题目列表、模拟考试、答题纸阅卷、学习激励、学科管理、模型管理

#### Scenario: 学习分析入口

- **WHEN** 管理员点击「学习分析」
- **THEN** 进入 `/analytics` 页面，展示学生学习行为统计

#### Scenario: 管理员 AI 助理入口

- **WHEN** 管理员查看侧边栏的「系统设置」组
- **THEN** 显示「AI 助理」，点击进入 `/ai-assistants`

#### Scenario: 移动端抽屉

- **WHEN** 管理员在移动端（≤768px）访问
- **THEN** 侧边栏默认隐藏，点击汉堡按钮以抽屉方式滑出
- **AND** 点击遮罩或选择入口后自动收起

#### Scenario: 学生侧边栏

- **WHEN** 学生登录
- **THEN** 侧边栏显示「工作台」「章节学习」「学习资源」
- **AND** 仅当该学生已获 AI 助理授权时显示「AI 助理」
- **AND** 顶部不显示学科切换器
- **AND** 侧边栏不出现「学习分析」
