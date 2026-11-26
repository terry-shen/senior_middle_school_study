## Context

当前 `LearningEvent` 只保存资源打开、学习会话、下载和登录/退出等语义事件，学习分析查询会一次读取区间内最多 5000 条事件，并依赖事件类型计算内容时长、章节覆盖等指标。`StudentAssetOpen` 只保存最近 200 条资源打开记录。现有前端没有全局点击采集，也没有按时间清理访问日志的任务。

访问流水与学习统计的用途不同：前者是短周期、明细、可丢弃的行为轨迹，后者是较长时间跨度的学习结果。两者混存会让分析查询变慢，也会让清理策略互相牵制。

## Goals / Non-Goals

**Goals:**

- 用一张独立、可快速清理的表保存学生最近 7 天的访问流水。
- 覆盖页面访问、导航、学科、章节、资源、视频控制、筛选和通用按钮点击。
- 以批量写入代替逐点击请求，保证学习流程不被埋点阻塞。
- 提供最小可用的管理端查看入口，能按学生查看最近 7 天明细。
- 不记录输入内容、密码、搜索关键词、剪贴板或鼠标轨迹。

**Non-Goals:**

- 不替换或修改现有 `LearningEvent` 的学习统计口径。
- 不把访问流水用于内容学习时长、视频完成率、章节覆盖等指标。
- 不记录管理员操作，不做跨学生排名或行为画像。
- 不做外部日志平台、导出、实时大屏或长期归档。
- 不清理 `DailyUsage`、`LearningEvent` 或 `StudentAssetOpen`。

## Decisions

### 1. 新增独立 `StudentActivityLog` 表

不复用 `learning_events`。字段设计：

```text
id
studentId       必填，关联 Student，学生删除时级联删除
sessionId       可选，记录所属登录会话，仅存整数，不做外键
type            事件类型
pagePath        页面路径，不含查询参数
target          目标标识，如 sidebar:math、subject:3
label           可读名称，截断后保存
subjectId       可选学科 ID
sectionId       可选小节 ID
assetId         可选资源 ID
meta            小型 JSON 字符串，最多 2 KB
createdAt       服务端接收时间
```

`subjectId`、`sectionId`、`assetId` 只存整数，不建立外键。访问流水是短周期数据，不应因资源下线、章节调整而级联删除；需要展示名称时优先使用采集时的 `label`，必要时再按 ID 查询。

索引：

```text
(studentId, createdAt)
(createdAt)
(sessionId)
```

**替代方案：** 复用 `LearningEvent`，实现最省事，但会污染分析查询、增加 5000 条读取成本，并让 7 天清理与长期学习统计冲突，因此不采用。

### 2. 前端使用“语义事件 + 通用点击兜底”

在 `AuthProvider` 内新增 `ActivityLogProvider`，只对 `user.role === 'student'` 启动。它做两件事：

1. 监听 React Router 路径变化，记录 `page_view`。
2. 在 `document` 捕获阶段监听 `click`，找到最近的 `[data-track]`、链接、按钮或 `role="button"` 元素，记录一次点击。

事件类型：

```text
page_view       页面访问
nav_click       导航点击
subject_open    打开学科
chapter_open    打开小节
asset_open      打开资源
video_play      视频播放
video_pause     视频暂停
video_ended     视频结束
video_seek      视频拖动
search          提交搜索
filter          切换筛选
download        下载
ui_click        未专门标记的通用点击
```

带 `data-track` 的元素使用显式类型和标签，例如：

```html
<Link data-track="subject_open" data-track-target="subject:3" data-track-label="数学">
```

没有标记的元素由兜底逻辑生成 `ui_click`，标签优先取 `aria-label`、`title`、元素文本，截断到 80 字符。文本输入框、密码框、文本域不记录点击内容；`pagePath` 只取 `pathname`，不保存查询字符串中的搜索词。

**替代方案：** 只记录路由变化，数据量最小，但会漏掉页内筛选、折叠、视频控制等操作；只记录原始 DOM 点击，噪声和体积都过高。混合方案更符合“记录所有点击”的意图。

### 3. 批量队列与上报

前端维护内存队列：

- 每 5 秒检查一次，有数据就发送。
- 队列达到 20 条立即发送。
- 单批最多 50 条，超过则拆成多批。
- 队列上限 500 条，网络长时间失败时丢弃最旧数据，避免占用内存。
- `visibilitychange=hidden` 和 `pagehide` 时用 `fetch(..., { keepalive: true })` 尽力发送。
- 上报失败不重试或最多重试一次；埋点失败不能影响页面。

服务端接口：

```text
POST /api/activity/events
Authorization: Bearer <token>
Body: { events: ActivityEventInput[] }
```

服务端只接受学生角色，使用 `req.user.id` 和 `req.user.sessionId` 补齐归属，使用服务端时间生成 `createdAt`。不接受客户端传入 `studentId` 或 `createdAt`。

批量校验：

- `events` 必须是 1～50 条的数组。
- `type` 必须在允许列表中。
- `pagePath` 必须以 `/` 开头且不超过 200 字符。
- `target` 不超过 120 字符，`label` 不超过 80 字符。
- `meta` 序列化后不超过 2 KB。
- 任一条非法时整批拒绝，避免部分写入造成难以排查的数据。

写入使用 `createMany` 或事务批量插入。当前 Prisma 5.22 支持 SQLite 的 `createMany`。

### 4. 鉴权上下文补充会话 ID

现有 `requireAuth` 已经把学生信息挂到 `req.user`，但没有会话 ID。访问流水需要把一次登录内的点击串起来，因此在 `authenticate` 中把 `result.session.id` 写入 `req.user.sessionId`。这不改变现有接口响应，只扩展请求上下文。

### 5. 7 天保留与分批清理

新增 `activity-log-service`，保留期常量：

```text
ACTIVITY_RETENTION_DAYS = 7
ACTIVITY_CLEANUP_BATCH = 2000
```

清理逻辑按 `createdAt < now - 7 天` 查询一批 ID，再按 ID 删除；循环直到没有可删数据。每批之间让出事件循环，避免长时间占用 SQLite 写锁。

调度：

- 服务启动后延迟 60 秒执行一次补偿清理。
- 每天北京时间 03:10 执行一次。
- 使用单例定时器，测试环境不启动。

只删除 `student_activity_logs`。现有 `LearningEvent`、`DailyUsage`、`StudentAssetOpen` 保持不变。

**替代方案：** 一次性删除全部过期记录，SQLite 可能长时间锁库；按 ID 分批更稳。每天 `VACUUM` 代价过高，不采用；SQLite 会复用空闲页，文件大小不必每天收缩。

### 6. 管理端查询与展示

新增接口：

```text
GET /api/activity/students/:id?days=7&type=&page=1&limit=50
```

仅管理员可访问。`days` 最大 7，返回：

```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "type": "chapter_open",
      "pagePath": "/learning/section/12",
      "target": "section:12",
      "label": "第一章 集合",
      "subjectId": 1,
      "sectionId": 12,
      "assetId": null,
      "meta": null,
      "createdAt": "2026-11-26T..."
    }
  ],
  "pagination": { "page": 1, "limit": 50, "total": 123, "totalPages": 3 },
  "retentionDays": 7
}
```

前端在 `LearningAnalytics` 的学生详情区域新增“访问明细”区块：类型筛选、时间倒序列表、加载更多、提示“仅保留最近 7 天”。不新增独立路由，不改变现有概览和 KPI。

**替代方案：** 独立访问日志页面，信息架构更清楚，但本期只需要按学生排查，放在现有详情区更省导航成本。

### 7. 关键交互的 `data-track` 标记

优先给以下位置补语义标记：

- `Sidebar`：工作台、学科、管理员/学生导航、退出登录。
- `Workbench`：继续学习、学科卡片、快捷入口。
- `ChapterMap`：视频/教辅标签、系列折叠、课程条目、资源条目、筛选/搜索。
- `ChapterDetail`：面包屑、返回、资源卡片、加载更多。
- `ResourceViewer` / `NetdiskBrowser`：视频播放、暂停、结束、拖动。
- AI 助理等页面的主要按钮由通用兜底覆盖，后续按需补语义。

### 8. 数据量与容量

按 7 天保留估算：

| 规模 | 7 天记录数 | 约占用 |
|---|---:|---:|
| 100 人 × 100 次/天 | 7 万 | 14～28 MB |
| 300 人 × 200 次/天 | 42 万 | 84～168 MB |
| 1000 人 × 300 次/天 | 210 万 | 420～840 MB |

当前 SQLite 数据库约 62 MB，主要是 5.5 万条资源元数据。访问流水在 1000 人高活跃场景下会成为主要增长项，因此独立表、批量写入、`createdAt` 索引和 7 天清理是必要组合。

## Risks / Trade-offs

- **[批量丢包]** 网络失败时最后一批可能丢失 → 埋点失败不影响主流程；页面隐藏时使用 `keepalive` 尽力补发，接受少量丢失。
- **[标签不稳定]** 通用点击依赖按钮文字或 `aria-label`，UI 改版后语义会变 → 关键路径使用 `data-track` 显式标记，通用兜底只作为补充。
- **[SQLite 写竞争]** 高并发批量写入仍可能与学习事件、进度写入竞争 → 单批限制 50 条、队列合并、清理分批、低峰执行；后续量级明显增长时再考虑独立日志库。
- **[隐私边界]** 误采集输入内容会带来隐私风险 → 输入框/文本域跳过，只记录动作和可读标签；`pagePath` 去掉查询参数。
- **[7 天数据不足]** 管理员查看 30/90 天分析时，访问明细只有 7 天 → UI 明确提示保留期，避免误解为无行为。
- **[重复事件]** 一次点击可能冒泡到多个可点击祖先 → 只取最近的 `[data-track]` 或可点击元素，并在捕获阶段处理一次。
- **[时区]** 清理按服务端时间，展示按北京时间 → 展示统一用现有前端本地时间格式；保留期按 7×24 小时计算，不做自然日边界。

## Migration Plan

1. 备份生产 SQLite 数据库。
2. 新增 Prisma 模型并执行 `prisma db push` 建表和索引。
3. 部署后端与前端；旧数据不需要回填。
4. 启动清理任务，先执行一次补偿清理。
5. 回滚时停止新版本服务即可；旧代码不会读取新表，表可保留，后续再次部署可继续使用。

## Open Questions

无。实现细节中的页面路径解析和具体 `data-track` 覆盖范围可在实施时按实际组件调整，不改变本设计的规格与边界。
