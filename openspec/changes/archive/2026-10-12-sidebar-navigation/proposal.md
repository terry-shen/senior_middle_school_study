## Why

当前管理员导航采用 5 个顶部下拉菜单，功能增多后不够直观——用户必须悬停才能发现子项，且知识点管理与知识点导入作为两个独立导航入口造成混淆（导入本质是管理的子操作）。首页功能卡片在系统功能稳定后价值降低，应改为工作台统计提供运营概览。侧边栏布局在同类教育系统中是更主流的选择，能同时展示全部功能入口，降低认知成本。

## What Changes

- 顶部下拉导航 → 左侧 220px 固定侧边栏（桌面端）；移动端降级为抽屉 drawer（汉堡按钮触发）
- 管理员侧边栏 6 分组：试卷管理（试卷库 / 题库管理）/ 题目管理（题目列表 / 难度管理）/ 知识点文档（知识点列表）/ 学生管理（学生列表 / 班级管理 / 学生错题本 / 学习激励）/ 考试管理（模拟考试 / 在线测验 / AI 批改 / 答题纸阅卷）/ 系统设置（模型管理）
- 学生侧边栏 4 项：模拟考试 / 错题本 / 我的答题纸 / 学习激励
- 知识点管理与知识点导入合并：移除独立的「知识点导入」导航入口，在知识点列表页工具栏添加「导入 Word 文档」按钮（导航到既有 /knowledge-points/import 页面，导入流程不变）
- 首页功能卡片 → 工作台统计仪表盘：展示试卷总数、题目总数、学生总数、考试总数、待批改答题纸数等关键指标卡片
- 当前活跃路由高亮（侧边栏项 active 状态）

## Capabilities

### New Capabilities

无。

### Modified Capabilities

- `admin-dashboard`: MODIFIED「管理员导航菜单分组」requirement — 顶部下拉改为左侧固定侧边栏 + 移动端抽屉；ADDED「工作台首页」requirement — 功能卡片改为统计仪表盘
- `knowledge-point-management`: MODIFIED「知识点文档管理」requirement — 列表页工具栏新增「导入 Word 文档」按钮入口
- `knowledge-point-import`: MODIFIED「Word文档导入知识点」requirement — 入口从独立导航项改为知识点列表页工具栏按钮触发

## Impact

- 纯前端变更，无后端 API / DB schema 改动
- `frontend/src/App.tsx`：导航结构重写（NavDropdown 组件 → Sidebar 组件），路由不变
- `frontend/src/App.css`：侧边栏布局样式 + 移动端响应式 drawer + active 高亮
- `frontend/src/pages/KnowledgePointManagement.tsx`：列表页工具栏加「导入」按钮
- 新建 `frontend/src/components/Sidebar.tsx`：侧边栏组件（管理员/学生分组 + 路由高亮 + 移动端 drawer 触发）
- 新建 `frontend/src/pages/Workbench.tsx`（或改造现有 dashboard）：工作台统计卡片
- 工作台统计数据来自既有 API（GET /api/papers?purpose=whole_paper、GET /api/papers/questions/all、GET /api/students、GET /api/exam-sessions、GET /api/answer-sheets?status=submitted），无需新增后端端点
