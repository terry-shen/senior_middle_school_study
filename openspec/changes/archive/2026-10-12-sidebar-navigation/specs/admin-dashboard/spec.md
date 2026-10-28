## MODIFIED Requirements

### Requirement: 管理员导航菜单分组

系统管理员导航 SHALL 采用左侧固定侧边栏布局（桌面端宽度 220px），按 6 个功能域分组展示全部功能入口，当前活跃路由高亮。移动端（宽度 ≤768px）侧边栏降级为抽屉 drawer，通过汉堡按钮触发展开/收起。

#### Scenario: 桌面端侧边栏布局

- **WHEN** 管理员在桌面端（宽度 >768px）登录后进入任意管理页面
- **THEN** 左侧固定显示 220px 宽的侧边栏，包含全部 6 个功能域分组的所有入口
- **AND** 主内容区域占据剩余宽度，侧边栏不遮挡内容
- **AND** 当前活跃路由对应的侧边栏项高亮显示

#### Scenario: 试卷管理下拉菜单

- **WHEN** 管理员查看侧边栏「试卷管理」分组
- **THEN** 显示「试卷库」和「题库管理」两个入口
- **AND** 「试卷库」导航到 /paper-library
- **AND** 「题库管理」导航到 /question-bank

#### Scenario: 题目管理下拉菜单

- **WHEN** 管理员查看侧边栏「题目管理」分组
- **THEN** 显示「题目列表」和「难度管理」两个入口
- **AND** 「题目列表」导航到 /questions
- **AND** 「难度管理」导航到 /difficulty

#### Scenario: 学生管理下拉菜单

- **WHEN** 管理员查看侧边栏「学生管理」分组
- **THEN** 显示「学生列表」「班级管理」「学生错题本」「学习激励」四个入口
- **AND** 「学生错题本」点击后跳转学生列表选择学生再查看其错题本

#### Scenario: 考试管理下拉菜单

- **WHEN** 管理员查看侧边栏「考试管理」分组
- **THEN** 显示「模拟考试」「在线测验」「AI 批改」「答题纸阅卷」四个入口
- **AND** 「模拟考试」为主入口（整卷 + 在线统一创建）

#### Scenario: 系统设置下拉菜单

- **WHEN** 管理员查看侧边栏「系统设置」分组
- **THEN** 显示「模型管理」入口
- **AND** 导航到 /llm-management

#### Scenario: 移动端抽屉 drawer

- **WHEN** 管理员在移动端（宽度 ≤768px）访问管理页面
- **THEN** 侧边栏默认收起隐藏
- **AND** 顶部显示汉堡按钮
- **AND** 点击汉堡按钮后侧边栏以抽屉方式从左侧滑出，覆盖部分内容
- **AND** 点击抽屉外区域或选择某入口后抽屉自动收起

#### Scenario: 学生侧边栏

- **WHEN** 学生角色用户登录后进入任意页面
- **THEN** 左侧侧边栏显示「模拟考试」「错题本」「我的答题纸」「学习激励」4 个入口
- **AND** 当前活跃路由高亮
- **AND** 移动端同样降级为抽屉 drawer

## ADDED Requirements

### Requirement: 工作台首页

系统首页 SHALL 展示工作台统计仪表盘，以关键指标卡片形式呈现系统运营概览，替代原有的功能卡片入口。

#### Scenario: 管理员工作台

- **WHEN** 管理员访问首页 / 路由
- **THEN** 显示工作台统计卡片：试卷总数、题目总数、学生总数、考试总数、待批改答题纸数
- **AND** 每个卡片显示数字和标签，数据来自既有 API
- **AND** 卡片下方可显示最近活动列表（最近导入的试卷、最近提交的答题纸）

#### Scenario: 学生工作台

- **WHEN** 学生访问首页 / 路由
- **THEN** 显示学生工作台：待完成的考试数、错题总数、已掌握错题数、学习连续天数
- **AND** 数据来自既有 API

#### Scenario: 工作台数据来源

- **WHEN** 工作台加载统计数据
- **THEN** 试卷总数来自 GET /api/papers（purpose=whole_paper 计数）
- **AND** 题目总数来自 GET /api/papers/questions/all（total 字段）
- **AND** 学生总数来自 GET /api/students（total 字段）
- **AND** 考试总数来自 GET /api/exam-sessions（status=published 计数）
- **AND** 待批改数来自 GET /api/answer-sheets?status=submitted（total 字段）
- **AND** 不新增后端端点，全部复用既有 API
