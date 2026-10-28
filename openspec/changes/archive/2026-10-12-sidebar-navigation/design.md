## Context

当前系统导航采用顶部 5 下拉菜单（system-menu-and-exam-merge 变更引入），桌面端悬停展开子项。知识点管理与知识点导入是两个独立导航入口。首页 / 展示功能卡片。

本变更为纯前端重构，不涉及后端 API 或 DB schema。目标：顶部下拉 → 左侧固定侧边栏 + 移动端抽屉；知识点两入口合一；首页功能卡片 → 工作台统计。

## Decisions

### Decision 1: 新建 Sidebar 组件替代 NavDropdown

**选择**: 新建 `frontend/src/components/Sidebar.tsx`，App.tsx 中用 `<Sidebar />` 替代现有 NavDropdown 组件。

**理由**: 侧边栏是持久可见的布局组件（区别于 dropdown 的临时弹出），独立组件便于维护和测试。组件内部按 `user.role` 渲染管理员 6 分组或学生 4 项，使用 `useLocation()` 获取当前路由并高亮 active 项。

**替代方案（否决）**: 直接在 App.tsx 内联侧边栏 JSX — 代码量大且混合布局与路由逻辑，不利于维护。

### Decision 2: CSS flex 布局 + media query drawer

**选择**: App 根容器 `display: flex`，Sidebar `width: 220px; flex-shrink: 0`，主内容区 `flex: 1`。移动端（`@media (max-width: 768px)`）Sidebar `position: fixed; transform: translateX(-100%); transition: transform 0.3s`，`.open` 类时 `transform: translateX(0)`，外加半透明遮罩 backdrop。

**理由**: 纯 CSS 实现布局 + transform 动画，无需第三方库。drawer 开关状态用 React state (`sidebarOpen`) 管理，点击遮罩或导航项后自动关闭。

### Decision 3: 知识点导入入口合并到列表页工具栏

**选择**: `KnowledgePointManagement.tsx` 列表页标题栏区域新增「导入 Word 文档」按钮，点击 `navigate('/knowledge-points/import')`。导入页面本身（/knowledge-points/import）和流程保持不变。

**理由**: 导入是知识点管理的子操作，不应占据独立导航槽位。按钮放工具栏与「新建文档」并列，符合用户心智模型。导入页面和流程已稳定（Word→mammoth→Markdown→编辑器），无需改动。

### Decision 4: 工作台统计复用既有 API

**选择**: 新建 `frontend/src/pages/Workbench.tsx`，并行调用 5 个既有 API 获取统计数据：
- `GET /api/papers?purpose=whole_paper` → 试卷总数（whole_paper 计数）
- `GET /api/papers/questions/all?limit=1` → 题目总数（pagination.total）
- `GET /api/students?limit=1` → 学生总数（pagination.total）
- `GET /api/exam-sessions?status=published` → 考试总数
- `GET /api/answer-sheets?status=submitted` → 待批改答题纸数

学生工作台：`GET /api/exam-sessions/student/all`（待完成考试数）、`GET /api/wrong-questions`（错题总数）、`GET /api/incentive/stats`（学习连续天数）。

**理由**: 不新增后端端点，全部复用既有分页 API 的 total 字段或列表长度。工作台只是数据展示层，后端已有足够数据源。

**替代方案（否决）**: 新建 `GET /api/workbench/stats` 聚合端点 — 增加后端复杂度，且 5 个独立 API 并行调用延迟可接受（Promise.all）。

### Decision 5: App.tsx 路由不变，仅布局组件替换

**选择**: 所有现有路由（/paper-library、/question-bank、/questions 等）保持不变。App.tsx 的 `<BrowserRouter>` → `<AuthProvider>` → `<ToastProvider>` → `<ErrorBoundary>` → `<Suspense>` 层级不变。仅在 `<AppContent>` 内部把 `<NavDropdown>` 替换为 `<Sidebar>` + 主内容区包裹结构调整。

**理由**: 路由是 system-menu-and-exam-merge 刚稳定的成果，不应在本变更中改动。本变更只改布局外壳，不改路由语义。

## Risks

- **移动端 drawer 性能**: transform 动画在低端设备可能卡顿 → 使用 CSS transition（GPU 加速），避免 JS 动画库
- **工作台 API 并行延迟**: 5 个 API 并行调用，任一超时会阻塞 Promise.all → 用 Promise.allSettled 容错，部分失败时对应卡片显示「--」
- **侧边栏宽度挤占内容**: 220px 在小屏幕（1024px）下占比 21% → 可接受；768px 以下降级为 drawer
- **知识点导入入口变更的用户习惯**: 用户可能习惯从导航直接进入导入页 → 列表页工具栏按钮位置显眼，且导入页 URL 不变，书签仍有效

## Migration

- App.tsx：删除 NavDropdown 组件 + 顶部导航相关 CSS，替换为 Sidebar 组件 + flex 布局
- App.css：新增 .sidebar / .sidebar-item / .sidebar-group / .drawer-backdrop / .hamburger-btn 样式 + @media 768px 响应式
- KnowledgePointManagement.tsx：标题栏加「导入 Word 文档」按钮
- App.tsx：首页路由 / 从渲染 dashboard 卡片改为渲染 Workbench 组件
- 删除：App.tsx 中 dashboard feature-cards 相关代码 + CSS
