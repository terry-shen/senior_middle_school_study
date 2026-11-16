# admin-dashboard Delta

## MODIFIED Requirements

### Requirement: 管理员导航菜单分组

系统 SHALL 以侧边栏分组方式提供管理员导航，包含学习内容、学生管理、系统设置三组。

#### Scenario: 桌面端侧边栏
- **WHEN** 管理员登录
- **THEN** 左侧显示固定侧边栏，分组为「学习内容」（章节学习/章节管理/资源映射/学习资源）、「学生管理」（学生列表/学习分析）、「系统设置」（网盘绑定）

#### Scenario: 学习分析入口
- **WHEN** 管理员点击「学习分析」
- **THEN** 进入 `/analytics` 页面，展示学生学习行为统计

#### Scenario: 学生侧边栏无分析入口
- **WHEN** 学生登录
- **THEN** 侧边栏不出现「学习分析」
