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

### Requirement: 知识点管理界面
系统 SHALL 提供知识点的可视化管理界面，支持查看、编辑、导入、融合操作。

#### Scenario: 查看知识点树
- **WHEN** 管理员进入知识点管理页面
- **THEN** 系统以树形结构展示所有知识点，支持展开/折叠

#### Scenario: 编辑知识点
- **WHEN** 管理员点击某个知识点进行编辑
- **THEN** 系统显示编辑表单，可修改名称、描述、学习要求、前置依赖

#### Scenario: 知识点冲突处理
- **WHEN** 检测到重复或冲突的知识点
- **THEN** 系统列出冲突选项，管理员选择保留哪个版本或执行合并

### Requirement: 试题管理界面
系统 SHALL 提供试题的管理界面，支持导入、审核、编辑、删除操作。

#### Scenario: 试题导入管理
- **WHEN** 管理员进入试题导入页面
- **THEN** 系统显示导入工具（PDF上传、图片上传、手动添加）和导入历史

#### Scenario: 待审核试题列表
- **WHEN** AI生成的试题内容标记为待审核
- **THEN** 系统在待审核列表中展示，管理员可批量审核或逐个审核

#### Scenario: 试题编辑
- **WHEN** 管理员点击编辑某道试题
- **THEN** 系统显示编辑界面，可修改题干、选项、答案、解析、知识点、难度等

### Requirement: 学生反馈处理界面
系统 SHALL 提供学生反馈的处理界面，管理员可查看、处理反馈。

#### Scenario: 查看反馈列表
- **WHEN** 管理员进入反馈管理页面
- **THEN** 系统显示学生提交的反馈列表，包括反馈类型、题目、学生、时间

#### Scenario: 处理反馈
- **WHEN** 管理员点击处理某个反馈
- **THEN** 系统显示反馈详情和对应题目，管理员可选择采纳或驳回

#### Scenario: 批量处理反馈
- **WHEN** 多个反馈指向同一问题
- **THEN** 管理员可批量标记为已处理，一次性修改多个试题

### Requirement: 系统配置界面
系统 SHALL 提供系统配置界面，管理员可调整系统参数。

#### Scenario: LLM模型配置
- **WHEN** 管理员进入系统配置页面
- **THEN** 系统显示大模型配置选项（Ollama/云端API），可添加、编辑、测试模型

#### Scenario: 推荐算法配置
- **WHEN** 管理员调整推荐算法参数
- **THEN** 系统保存配置并更新推荐逻辑

#### Scenario: 权限管理
- **WHEN** 管理员进入权限管理页面
- **THEN** 系统显示角色和权限列表，可调整不同角色的访问权限

### Requirement: 数据统计界面
系统 SHALL 提供数据统计和报表界面，帮助管理员了解系统使用情况。

#### Scenario: 试题统计
- **WHEN** 管理员查看试题统计
- **THEN** 系统显示试题总数、按知识点分布、按难度分布、AI分析完成率

#### Scenario: 学生学习统计
- **WHEN** 管理员查看学生学习统计
- **THEN** 系统显示活跃学生数、平均掌握度、知识点掌握度分布

#### Scenario: 系统健康监控
- **WHEN** 管理员查看系统健康状态
- **THEN** 系统显示数据库连接状态、LLM调用成功率、系统响应时间

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

### Requirement: 学生错题本只读视图
管理员 SHALL 能以只读方式查看任意学生的错题本，包括错题列表、掌握度概览，但不能编辑、删除、重练。
#### Scenario: 从学生列表进入错题本
- **WHEN** 管理员在学生列表中点击某学生的「错题本」按钮
- **THEN** 导航到 /admin/students/:studentId/wrong-questions
- **AND** 显示该学生的错题卡片列表（只读模式）
- **AND** 不显示「拍照录入」「手动录入」「重练」「编辑」「删除」按钮
- **AND** 显示掌握度概览条形图
#### Scenario: 跨学生切换
- **WHEN** 管理员在学生错题本只读视图中选择「返回学生列表」
- **THEN** 返回学生列表页，可选择其他学生查看
#### Scenario: 后端只读查询端点
- **WHEN** 管理员调用 GET /api/wrong-questions/student/:studentId
- **THEN** 返回该学生的全部错题列表（含已掌握）
- **AND** requireAdmin 中间件校验权限
- **AND** 不返回其他学生的数据

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
