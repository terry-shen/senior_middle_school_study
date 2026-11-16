## 1. 数据库

- [x] 1.1 `prisma/schema.prisma` 新增 `LearningEvent`（studentId/type/sectionId?/assetId?/durationSec/meta/createdAt + 两个索引），Student 加反向关系 — 验证：`npx prisma validate` 通过
- [x] 1.2 `npx prisma db push`（先杀 node 解 DLL 锁）+ `prisma generate` — 验证：`learning_events` 表存在

## 2. 后端：采集

- [x] 2.1 新建 `services/learning-analytics-service.ts`：`recordEvent()`（durationSec 夹在 0–60）— 验证：单元调用后表内新增一行
- [x] 2.2 `routes/learning.ts` 新增 `POST /event`（requireAuth，学生本人）— 验证：200 且 `type` 落库
- [x] 2.3 `routes/netdisk.ts` 的 `mode=attachment` 分支记录 `download` 事件（按 fsId 反查 assetId）— 验证：下载一次后表内出现 download 事件

## 3. 后端：统计

- [x] 3.1 `getOverview(from,to)`：按学生聚合有效时长、视频时长、打开数、下载数、活跃天数、连续天数、最后活跃 — 验证：返回结构与数值合理
- [x] 3.2 `getStudentDetail(studentId,from,to)`：每日时长、24 小时活跃分布、章节 Top10 时长、学科占比、视频完成率、最近 30 条事件 — 验证：`1.1 集合的概念` 出现在 Top 章节中
- [x] 3.3 `routes/learning.ts` 新增 `GET /analytics/overview`、`GET /analytics/students/:id`（requireAuth+requireAdmin）— 验证：学生 token 访问返回 403

## 4. 前端：埋点

- [x] 4.1 `services/learning-api.ts` 新增 `reportLearningEvent()` 与统计类型/函数 — 验证：`tsc` 通过
- [x] 4.2 新建 `hooks/useStudyHeartbeat.ts`：可见期累计秒数，每 30 秒上报一次，`visibilitychange` 时 flush — 验证：停留 1 分钟后表内出现 heartbeat
- [x] 4.3 `App.tsx` 仅对 `role === 'student'` 启用心跳 — 验证：管理员登录后无 heartbeat 写入
- [x] 4.4 `ResourceViewer` 上报 `video_progress`（每 15 秒与关闭时）与 `download` — 验证：播放 20 秒后表内有 progress 事件
- [x] 4.5 `ChapterDetail` 打开资源时上报 `asset_open`（保留原 recordProgress）— 验证：点击资源后表内有 asset_open

## 5. 前端：看板

- [x] 5.1 新建 `pages/LearningAnalytics.tsx` + `.css`：区间切换（7/30/90 天）、学生概览表、点击行展开详情 — 验证：表格有数据、点击可展开
- [x] 5.2 详情区：每日时长柱状、24 小时热力、章节 Top、学科占比、最近行为列表 — 验证：各区块均有内容
- [x] 5.3 `App.tsx` 新增 `/analytics`（requireAdmin）路由；`Sidebar` 学生管理组新增「学习分析」— 验证：学生看不到入口
- [x] 5.4 概览表对 7 天零时长学生显示"沉默"标记 — 验证：无数据学生行有标记

## 6. 验证

- [x] 6.1 后端 `npm run build` + 重启 `/health` 200；前端 `npm run build` 通过
- [x] 6.2 API 回归：`POST /event` 四种类型、`/analytics/overview`、`/analytics/students/:id`、学生访问 403
- [x] 6.3 浏览器（admin1）：`/analytics` 可打开、概览表有张三数据、详情区图表渲染、0 console error
- [x] 6.4 学生端主流程不受影响：`/learning/math` 与 `/learning/section/1` 正常、资源可打开

## 实施记录

- 1.1-1.2：新增 LearningEvent（learning_events 表）+ Student/Section/NetdiskAsset 三处反向关系；prisma db push 与 generate 成功。
- 2.1-2.3：learning-analytics-service 的 recordEvent（类型白名单、heartbeat 夹 0–60、video 夹 0–600）；POST /api/learning/event；GET /api/netdisk/file?mode=attachment 服务端按 fsId 反查 assetId 并写 download 事件（实测下载 50KB docx 后 overview downloads=1）。
- 3.1-3.3：getOverview（有效时长/视频时长/打开/下载/活跃天数/连续天数/最后活跃/视频完成率）与 getStudentDetail（每日、24h 分布、章节 Top、学科占比、最近 30 条）；两个路由 requireAuth+requireAdmin，学生 token 实测 403。
- 4.1-4.5：reportLearningEvent + 统计类型；useStudyHeartbeat（可见期累计、30 秒 flush、visibilitychange/pagehide 立即补报）；App 仅对 student 启用；ResourceViewer 每 15 秒与关闭时上报 video_progress（只累计实际播放秒数，暂停/拖动不计）并在下载链接补 download；ChapterDetail 打开资源时上报 asset_open。
- 5.1-5.4：LearningAnalytics 页（7/30/90 天切换、学生概览表、点击行展开详情、每日柱状、24 格热力、章节 Top、学科占比、最近行为）；/analytics requireAdmin + 侧边栏「学生管理 › 学习分析」；零时长学生显示沉默标记。
- 6.1-6.4：后端 tsc + 前端 vite 构建通过、后端重启 /health 200；API 回归（四种事件 200、未知类型 400、overview/detail 200、学生访问 403）；浏览器 admin1 实测概览表 + 点击展开 KPI/图表/最近行为；学生停留 42 秒后有效时长由 30 秒增至 120 秒（心跳生效）；/learning/math 正常。测试事件已清理。
