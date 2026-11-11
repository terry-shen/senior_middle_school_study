# admin-dashboard Specification

## Purpose
提供独立的管理员后台界面，支持管理员进行知识点管理、试题导入与审核、学生反馈处理、系统配置等操作，与学生前端界面分离，提供专业的管理工具。

## Requirements

### Requirement: 管理员后台入口
系统 SHALL 提供独立的管理员后台入口，与学生前端分离。

#### Scenario: 管理员登录后台
- **WHEN** 管理员访问管理后台URL并输入账号密码
- **THEN** 系统验证管理员身份并进入后台管理界面

#### Scenario: 权限验证
- **WHEN** 非管理员账号尝试访问管理后台
- **THEN** 系统拒绝访问并提示权限不足

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
