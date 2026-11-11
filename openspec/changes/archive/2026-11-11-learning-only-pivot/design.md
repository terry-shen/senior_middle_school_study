# Design — learning-only-pivot

## Context

v2 的核心是「以视频课程为主线的章节学习」，但代码库仍保留 v1 的完整试卷链路。这些能力彼此依赖（试卷→考试→答题纸→错题→激励），一起构成约 9,000 行代码、16 张表、10 个前端页面。它们与章节学习唯一的连接点是章节详情页的两个入口与工作台的两块卡片，删除成本可控。

## Decisions

### D1 一次性删除，不做兼容层

删除代码、路由、服务、页面与数据表，不保留「只读查看」「导出」等兼容入口。理由：没有任何外部消费者，保留只会延长维护面。

执行顺序：`备份 dev.db` → 删代码 → `prisma db push --accept-data-loss`（自动 drop 表）→ 删实体内存引用 → 构建验证。`uploads` 中 `papers/`、`answer-sheets/` 目录在云端可回收（保留 `knowledge-points/` 为空的也无害）。

### D2 学科 Tab 取代全局切换器

删除 `SubjectSwitcher` 组件与顶栏注入；`SubjectContext` 保留（页面内部仍需要当前学科），但初始值改为「第一个 sectionCount>0 的学科」。`withSubjectParam` 保留给 learning/netdisk 请求使用。

学科 Tab 数据源新增 `GET /api/learning/subjects`：

```ts
[{ id, code, name, icon, color, sectionCount }]
```

`sectionCount` 由 `section.count({ where: { chapter: { textbook: { subjectId } } } })` 聚合（一次 groupBy 查询完成）。

### D3 建设状态由 sectionCount 推导，不新增字段

现有数据：数学 73、物理 124、化学 60、生物 81，其余 0。无需给 Subject 加 `isBuilt` 字段，避免双写不一致。

- `sectionCount > 0` → 可点击，Tab 用 `Subject.color`
- `sectionCount = 0` → 灰色 + 「待建设」角标，`disabled`

### D4 learning 服务瘦身

保留：

- `getSectionResources(sectionId, mode, page, limit)` — 精选 / 更多 / 管理
- `recordProgress` / `getProgress`
- `getVideoSeries(studentId, subjectId)` — 视频主线课程
- `getStudentSubjectProgress(studentId)` — 已浏览小节数（工作台用）

新增：

- `listLearningSubjects()` — 含 sectionCount
- `getRecentOpens(studentId, limit=5)` — 最近打开资源（基于 StudentLearningProgress 的 asset + section）

删除：`getSectionPapers`、`getSectionWrongQuestions`、`getLearningMap`、`getWorkbench`（pendingExams/weakTop 部分）。

路由 `/api/learning` 最终：

```
GET /subjects
GET /video-series?subjectId=
GET /sections/:id/resources?mode=&page=&limit=
GET /sections/:id/papers      → 删除
GET /sections/:id/wrong-questions → 删除
GET /map                      → 删除
GET /workbench                → 删除
GET /recent                   → 新增
POST /progress
GET /progress
```

### D5 工作台按角色重做

- 管理员：教材册数 / 章节数 / 小节数 / 已索引资源数 / 有资源小节数（`/api/chapters/tree` + `/api/netdisk-index/stats`）
- 学生：继续学习（`/api/learning/progress`）+ 我的学科（`/api/learning/subjects`）+ 最近打开（`/api/learning/recent`）

### D6 百度网盘 OAuth 回调环境变量化

`netdisk-service.ts` 的默认回调改为：

```ts
const DEFAULT_REDIRECT_URI = (process.env.PUBLIC_BASE_URL || 'http://localhost:3000') + '/api/netdisk/callback';
```

`docker-compose.yml` 的 api 环境变量增加 `PUBLIC_BASE_URL`（云端 `http://106.15.136.254`）。DB `NetdiskConfig.redirectUri` 在部署脚本中更新为公网地址。用户仍需在百度开放平台登记该回调地址；现有 access/refresh token 不受影响。

### D7 部署方式不变，仅重建镜像

代码改动通过 `rsync/scp` 到 `/www/highschool-system`，`docker compose build api web && docker compose up -d`。数据卷 `data/db`、`data/uploads` 不变（先备份 db 到 `backups/`）。

## Risks

| 风险 | 缓解 |
|---|---|
| 误删仍被引用的代码导致编译失败 | 删除后 `tsc --noEmit` + `vite build` + 浏览器逐页验证 |
| 数据删除不可逆 | 部署前 `cp dev.db backups/dev-<date>.db`；云端另存一份 |
| 百度回调未登记导致无法重新授权 | 现有 token 仍有效；文档写明需登记公网回调 |
| 其他学科（语文等）Tab 点击无内容 | sectionCount=0 直接禁用并标注「待建设」 |
