## 1. 数据模型与本地迁移

- [x] 1.1 在 `backend/prisma/schema.prisma` 新增 `StudentActivityLog` 模型：`studentId`、可选 `sessionId`、`type`、`pagePath`、`target`、`label`、`subjectId`、`sectionId`、`assetId`、`meta`、`createdAt`，并为 `Student` 增加关系；运行 `npx prisma validate` 通过。
- [x] 1.2 为访问流水增加 `(studentId, createdAt)`、`(createdAt)`、`(sessionId)` 索引，运行 `npx prisma generate` 通过。
- [x] 1.3 本地执行 `npx prisma db push --skip-generate`，用 Prisma 查询确认 `student_activity_logs` 表及索引存在。

## 2. 后端访问流水服务

- [x] 2.1 新增 `backend/src/services/activity-log-service.ts`，定义事件类型白名单、单条与批量校验、批量写入、按学生分页查询和 7 天清理函数；用类型检查通过验证。
- [x] 2.2 实现服务端字段约束：`events` 1～50 条、`pagePath` 最长 200、`target` 最长 120、`label` 最长 80、`meta` 序列化后最长 2 KB，非法类型整批拒绝；用单元测试覆盖合法与非法批次。
- [x] 2.3 实现按 `createdAt < now - 7 天` 分批删除，默认每批 2000 条，循环清理直到无过期数据；用插入旧记录、执行清理、检查剩余行数的测试验证。
- [x] 2.4 确认清理只删除 `student_activity_logs`，`LearningEvent`、`DailyUsage`、`StudentAssetOpen` 行数不变；用测试或本地数据库前后计数验证。

## 3. 后端接口与调度

- [x] 3.1 扩展 `backend/src/middleware/permission.ts` 的 `req.user` 增加 `sessionId`，由 `authenticate` 从当前 Session 补齐；用学生请求 `/api/auth/me` 或测试中间件验证会话 ID 可用。
- [x] 3.2 新增 `backend/src/routes/activity.ts`：`POST /api/activity/events` 仅学生可调用，批量写入并使用服务端学生/会话/时间；未登录、管理员、非法类型均返回正确错误；用 API 请求验证。
- [x] 3.3 新增 `GET /api/activity/students/:id?days=7&type=&page=&limit=`，仅管理员可调用，`days` 最大 7，返回分页数据与 `retentionDays`；用管理员和学生 token 分别验证 200/403。
- [x] 3.4 在 `backend/src/index.ts` 注册访问流水路由，并启动每日 03:10 清理与启动后 60 秒补偿清理；测试环境不启动定时器，用本地构造过期数据验证清理触发。
- [x] 3.5 为批量上报和查询增加请求体大小限制与基础防滥用保护（单批上限、字段长度、未知类型拒绝）；用超长字段和超量批次请求验证被拒绝。

## 4. 前端采集与批量队列

- [x] 4.1 新增 `frontend/src/services/activity-log-api.ts`，定义事件类型、批量上报函数和管理员查询类型；后端未启动时 TypeScript 构建仍通过。
- [x] 4.2 新增 `frontend/src/contexts/ActivityLogContext.tsx`：仅学生启动，监听路由变化记录 `page_view`，全局捕获点击，维护 5 秒/20 条触发、单批最多 50 条的内存队列；用浏览器 Network 面板确认批量请求。
- [x] 4.3 实现队列上限、失败隔离、`visibilitychange`/`pagehide` 的 `keepalive` 发送；模拟断网后确认页面操作不受影响，恢复网络后可继续发送。
- [x] 4.4 实现隐私边界：跳过输入框、密码框、文本域，`pagePath` 不含查询参数，`label` 截断到 80 字符；用搜索框输入和长按钮文本验证不落库完整内容。
- [x] 4.5 在 `Sidebar`、`Workbench`、`ChapterMap`、`ChapterDetail` 为导航、学科、章节、资源、标签页、筛选和主要按钮补充 `data-track`；点击后确认事件类型与目标标识正确。
- [x] 4.6 在 `ResourceViewer` 和 `NetdiskBrowser` 的视频 `play`/`pause`/`ended`/`seeked` 处上报视频控制事件；播放、暂停、拖动和结束后检查访问明细类型。

## 5. 管理端访问明细

- [x] 5.1 在 `frontend/src/services/learning-api.ts` 或独立 API 中增加访问明细查询函数与类型；前端构建通过。
- [x] 5.2 在 `frontend/src/pages/LearningAnalytics.tsx` 学生详情新增“访问明细”区块：事件类型筛选、时间倒序、加载更多、空状态和“仅保留最近 7 天”提示；用有数据的学生验证展示。
- [x] 5.3 为访问明细补充 `LearningAnalytics.css` 桌面与移动端样式，确认 390px 宽度无横向溢出；用移动端视口截图或滚动宽度检查。
- [x] 5.4 验证访问明细只展示当前学生数据，切换学生后列表重新加载；用两名学生数据检查不会串数据。

## 6. 验证与发布

- [x] 6.1 后端运行 `npm run build`、相关 Jest 测试和访问流水单元测试，确认通过；记录历史遗留测试套件的失败范围。
- [x] 6.2 前端运行 `npm run build` 和 `npm run lint`，确认新增代码无 error。
- [x] 6.3 Playwright 验证关键流程：学生点击侧边栏学科、章节、资源、视频控制后产生批量请求；管理员详情能看到对应访问明细；学生无法访问查询接口。
- [x] 6.4 本地构造 8 天前与 6 天前的访问记录，执行清理任务，确认 8 天前被删除、6 天前保留，且现有学习事件未被删除。
- [ ] 6.5 生产发布前备份数据库，执行 `prisma db push` 创建新表与索引，部署 api/web 并重启服务。
- [ ] 6.6 生产验证：学生操作产生访问流水；管理员查看最近 7 天明细；清理任务可执行；确认旧学习分析指标不受影响。

