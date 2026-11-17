## 1. 后端：事件口径

- [x] 1.1 `learning-analytics-service.ts`：`EVENT_TYPES` 改为 `asset_open|asset_session|download|login`，移除 `heartbeat` 与 `video_progress` — 验证：上报 heartbeat 返回 400
- [x] 1.2 `recordEvent` 新增 `asset_session` 处理：`durationSec` 夹 0–7200、丢弃 <5 秒会话、按 `meta.duration` 与 `meta.kind` 夹取停留（视频 ×1.2、文档 1800）— 验证：构造 3 秒会话与超长视频会话，入库值符合护栏
- [x] 1.3 历史数据清理脚本（一次性，读环境变量确认）：删除 `heartbeat`、`video_progress`、`asset_dwell` — 验证：清理后三类事件计数为 0，其余类型保留

## 2. 后端：指标计算

- [x] 2.1 `getOverview` 用 `contentSec`（Σ asset_session.durationSec）替换 `studySec`，保留 `studySec` 字段同值兼容一版 — 验证：接口同时返回两个字段且相等
- [x] 2.2 视频指标：`videoSec`（Σ meta.playSec）、`videoCompletion`（完成度 ≥90% 占比）、`watchedVideos`（distinct assetId）— 验证：造 3 条不同完成度会话，占比为 1/3
- [x] 2.3 覆盖指标：`coveredSections`（distinct 有小节归属的 session/open）、`coverageRate`（÷ 学科小节总数，按学科分别给出）— 验证：数学造 2 节 → 2/73
- [x] 2.4 回访指标：`revisitAssets`（asset_open ≥2 的 distinct assetId）— 验证：同一资源打开 3 次计 1
- [x] 2.5 `getStudentDetail` 新增：`progressBuckets`（6 区间视频数）、`coverageBySubject[]`、`downloads[]`（倒序明细含名称与四级路径）、`topAssets` 增加 `opens`/`playSec`/`completion`/`revisit` — 验证：接口结构完整，无 null 崩

## 3. 后端：路由

- [x] 3.1 `routes/learning.ts`：`POST /event` 不再接受 heartbeat（由 1.1 覆盖），`GET /analytics/overview` 与 `/students/:id` 返回新字段 — 验证：curl 两个接口字段齐全
- [x] 3.2 `routes/netdisk.ts` 下载钩子保留，`meta.name` 写入文件名 — 验证：下载后 detail 的 downloads 含文件名

## 4. 前端：移除心跳与全局计时

- [x] 4.1 删除 `hooks/useStudyHeartbeat.ts` 与 `services/study-context.ts`，移除 `App.tsx` 中的调用 — 验证：全站不再出现 `/learning/event` 的 heartbeat 请求
- [x] 4.2 `ResourceViewer.tsx` 移除 `video_progress` 与 `asset_dwell` 上报，改为关闭时一条 `asset_session`（含 playSec / position / duration / kind / name / 停留秒数）；session 期间每 60 秒补报 — 验证：播 15 秒关闭，DB 出现 1 条 asset_session 且 meta.playSec≈15
- [x] 4.3 `NetdiskBrowser.tsx` 同样改造（打开上报 `asset_open`、关闭上报 `asset_session`、下载上报 `download`）— 验证：学习资源页打开视频关闭后产生 1 条 session
- [x] 4.4 `ChapterDetail.tsx` 去掉 study-context 依赖，保留 `recordProgress` 与 `asset_open` — 验证：打开资源后学习进度更新

## 5. 前端：看板改造

- [x] 5.1 `learning-api.ts` 类型更新：`AnalyticsOverviewRow`（contentSec/videoSec/videoCompletion/watchedVideos/coveredSections/coverageRate/revisitAssets/downloads/activeDays/streak/lastActiveAt）、`AnalyticsDetail` 增加 progressBuckets/coverageBySubject/downloads — 验证：tsc 通过
- [x] 5.2 概览表列替换：内容学习时长 / 视频观看时长 / 看过的视频 / 视频完成率 / 覆盖小节 / 回访资源 / 下载 / 活跃天数 / 连续天数 / 最后活跃（移除「有效学习时长」）— 验证：表头 10 列与文案一致
- [x] 5.3 详情页：KPI 卡改为 内容学习时长 / 视频观看时长 / 覆盖小节 / 回访资源 / 下载资料；新增「视频完成度分布」条形区、按学科覆盖率条、下载明细表 — 验证：三块均渲染
- [x] 5.4 概览顶部加口径说明：「仅统计打开资源后的学习；主页与列表页停留不计入」— 验证：文案可见

## 6. 验证

- [x] 6.1 后端 `npm --prefix backend run build` + 重启 `/health` 200；前端 `npm --prefix frontend run build` 通过
- [x] 6.2 API 回归：heartbeat 400、asset_session 200（含护栏）、overview/detail 字段齐全、学生访问 403
- [x] 6.3 真实学生端到端：登录 → 章节页播放视频 20 秒关闭 → 打开 PDF 阅读 10 秒关闭 → 下载一份 docx → 管理端看到内容时长、播放时长、覆盖小节 +1、回访（重复打开）+1、下载明细 1 条
- [x] 6.4 确认主页/章节列表停留 60 秒后内容学习时长不变
- [x] 6.5 控制台 0 error，`/learning/math`、`/analytics` 无 ErrorBoundary

## 实施记录

- 1.1-1.3：learning-analytics-service 重写，事件类型收敛为 asset_open/asset_session/download/login（heartbeat 上报返回 400）；asset_session 护栏：dwell 与 play 均 <5 秒丢弃、有视频时长时 dwell > duration×1.2 丢弃、无时长时 dwell >1800 丢弃，服务端夹 0–7200；download 60 秒去重。
- 2.1-2.5：Agg/accumulate 汇总 contentSec、videoSec、opens、downloads、sections、openCount；getOverview 返回内容学习时长/视频观看/覆盖章节/回访资源/下载等；getStudentDetail 新增 progress（逐视频完成度 + 10 区间分布）、coverage（覆盖 408 节，按学科）、downloads（最近 50 条）与 topAssets（dwellSec/playSec）。
- 3.1-3.2：路由沿用 /event、/analytics/overview、/analytics/students/:id，仅 requireAdmin 分析接口；API E2E：asset_session 200、短会话 skipped、heartbeat 400、totals 与 progress/coverage 结构正确。
- 4.1-4.4：删除 useStudyHeartbeat 与 App 调用；ResourceViewer/NetdiskBrowser 改为关闭时一次性上报 asset_session（meta 带 name/kind/playSec/position/duration）；内嵌 PDF/图片计停留，仅可下载文档只记 asset_open + download。
- 5.1-5.4：LearningAnalytics 概览 12 列、KPI 7 项，新增视频进度分布、章节覆盖、资料下载明细区块；修复 0 秒显示为「0 秒」与下载明细被误嵌在进度条件块内导致不渲染的问题。
- 6.1-6.5：后端 tsc + 前端构建通过、后端重启 /health 200；purgeLegacyEvents 清理 109 条历史事件（heartbeat 43 / video_progress 58 / asset_dwell 8）；浏览器实测 9 个区块渲染、空态文案正常、无报错。
