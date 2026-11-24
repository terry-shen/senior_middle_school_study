## 1. 数据模型与迁移

- [x] 1.1 扩展 `Session`：增加 `lastActiveAt`、`lastSeenAt`、`endedAt`、`endReason`、`activeSec`，并为 `Student` 增加每日使用时长关系；运行 `npx prisma validate` 通过。
- [x] 1.2 新增 `DailyUsage` 模型（`studentId`、`date`、`activeSec`、`loginCount`、`firstLoginAt`、`lastLogoutAt`，学生+日期唯一）；运行 `npx prisma validate` 通过。
- [x] 1.3 在 `EVENT_TYPES` 中加入 `logout`，并确认登录/退出事件可写入 `LearningEvent`；运行后端类型检查通过。
- [x] 1.4 本地执行 Prisma 生成与数据库同步，确认 `sessions` 新列与 `daily_usage` 表存在；用 `sqlite3` 或 Prisma Studio 检查。

## 2. 会话生命周期后端

- [x] 2.1 新增会话服务：登录创建会话、按 token 校验、结束会话（幂等）、写入每日登录/退出汇总；为服务编写单元测试并验证重复结束不会产生两条退出事件。
- [x] 2.2 登录成功时记录 `login` 事件与 `DailyUsage.loginCount`，返回 token 与登录时间；调用登录接口验证响应与数据库记录。
- [x] 2.3 改造 `requireAuth` 与 `requireAdmin`：拒绝 `endedAt` 非空、已过期或 `lastActiveAt` 超过 30 分钟的会话；对 `lastSeenAt` 做节流更新；用过期/空闲会话请求验证返回 401。
- [x] 2.4 改造 `logoutStudent`：不再删除 Session，写入 `endedAt`、`endReason=manual` 和 `logout` 事件；调用登出接口后验证 token 再请求返回 401，且会话记录仍存在。
- [x] 2.5 `getStudentByToken` 增加 `endedAt` 与空闲检查；用已结束会话调用 `/api/auth/me` 验证 401。
- [x] 2.6 新增 `POST /api/auth/heartbeat`：`active=false` 只更新 `lastSeenAt`；`active=true` 更新 `lastActiveAt`、`activeSec` 与当天 `DailyUsage.activeSec`，单次增量不超过 60 秒；用连续心跳验证累计值。
- [x] 2.7 新增会话 sweeper：每 60 秒关闭 `lastSeenAt` 超过 3 分钟的未结束会话，写入 `disconnected` 与 `logout` 事件；用构造的过期会话验证只关闭一次。
- [x] 2.8 增加服务端空闲兜底：请求命中 30 分钟未活跃会话时标记 `idle` 并写退出事件；用直接修改 `lastActiveAt` 的会话验证 401 与原因。

## 3. 学习分析接口

- [x] 3.1 `getOverview` 聚合区间 `DailyUsage.activeSec`，为每个学生返回 `usageSec`；用两名学生、跨天数据验证汇总正确。
- [x] 3.2 `getStudentDetail` 返回区间使用时长、今日使用时长与按天使用时长；用跨零点数据验证两天分别归属。
- [x] 3.3 最近行为查询包含 `login`/`logout` 事件，并返回退出原因；用登录、手动退出、空闲退出三种记录验证。
- [x] 3.4 确认 `learning-analytics` 原有内容学习、视频、下载、章节覆盖指标不受使用时长影响；运行现有后端测试。

## 4. 前端会话与空闲控制

- [x] 4.1 `AuthContext` 的 `logout` 支持原因参数，并在心跳/业务请求 401 时统一清理 token、跳转登录页；用失效 token 验证自动跳转。
- [x] 4.2 新增 `ActivityProvider`：提供 `markActive()` 与 `setVideoPlaying()`，监听点击、按键、滚动、触摸和页面可见性；用开发工具确认活跃状态更新。
- [x] 4.3 实现 presence 心跳（60 秒）与 activity 心跳（活跃时最多 60 秒一次，首次交互立即补发）；用 Network 面板验证两种请求频率。
- [x] 4.4 实现 29 分钟提醒、30 分钟自动退出和“继续使用”按钮；用缩短阈值的测试配置或假时钟验证提醒、重置与退出。
- [x] 4.5 使用 `BroadcastChannel`（回退 localStorage）同步多标签页活跃时间与退出；打开两个标签页验证一个活跃时另一个不会误退出。
- [x] 4.6 `pagehide`/`visibilitychange` 时尽力更新最后在线时间，不直接结束会话；刷新页面验证仍保持登录。

## 5. 视频播放活跃

- [x] 5.1 `ResourceViewer` 监听视频 `play`/`playing`/`pause`/`ended`，播放时持续活跃，暂停或结束后停止；用视频资源验证心跳变化。
- [x] 5.2 `NetdiskBrowser` 视频弹窗接入同一套播放状态；验证播放中不触发空闲退出、结束后恢复计时。
- [x] 5.3 视频播放中切换标签页仍保持活跃，暂停后隐藏页面按普通空闲处理；用浏览器标签切换验证。

## 6. 学习分析页面

- [x] 6.1 学生概览表增加“使用时长”列，并更新前端类型；用有使用记录的学生验证显示。
- [x] 6.2 学生详情增加区间/今日使用时长 KPI；用跨天数据验证两个数值。
- [x] 6.3 最近行为增加登录/退出标签、退出原因与时间展示；验证三种退出原因均可读。
- [x] 6.4 补充登录/退出标签与时长列的样式，检查桌面与移动端布局不溢出。

## 7. 验证与发布

- [x] 7.1 后端运行构建、类型检查与相关测试，确认全部通过。（相关 20 项测试通过；全量 jest 仍有 6 个历史套件因已删除的 `llm-service`/`paper-metadata-service` 失败，与本次变更无关）
- [x] 7.2 前端运行构建、lint 与 Playwright 关键流程（登录、空闲提醒、手动退出、分析页），确认全部通过。
- [ ] 7.3 生产发布前备份数据库，执行 `prisma db push` 增加字段与表，部署 api/web 并重启服务。
- [ ] 7.4 生产验证：登录产生会话与 login 事件、心跳累计使用时长、30 分钟空闲退出、关闭标签页后 3 分钟离线退出、学习分析显示使用时长与登录/退出记录。
