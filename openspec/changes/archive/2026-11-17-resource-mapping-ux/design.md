# Design — resource-mapping-ux

## Context

见 `proposal.md — Why`。当前实现的关键约束（已核对代码与数据）：

- 学生端可见性规则固定为 `status=active AND audience in (student,both) AND mapConfirmed=true`（`learning-service.ts` 的 `STUDENT_VISIBLE`），本次不改
- `batchAction` 已支持 move / confirm / pin / unpin / archive / restore / ignore / unmap，全部按 `id in (ids)` 生效
- 未映射 active 资源 38,843 条：teacher 13,066 / both 25,381 / student 396；其中 `教辅资料合集` 单目录 28,927 条
- 每节精选上限 5（`MAX_PINNED_PER_SECTION`），收敛判定 3–5（`sectionConvergence`）
- 页面当前为三栏布局：章节树 / 表格 / 批量按钮栏

## Goals / Non-Goals

**Goals**
- 让管理员在 3 次点击内完成"某个节的学生端资源收敛"
- 让"这个按钮会让学生看到什么"在点击前就可见
- 让 2.9 万条旧教辅噪音可以用目录级操作一次收敛，而不是逐条勾选

**Non-Goals**
- 不改数据库 schema、不改学生端可见性规则
- 不做自动批量挂载（目录 → 章自动分摊到多节），v1 仍需管理员指定单节
- 不做映射质量评分/机器学习，候选仍基于现有关键词打分

## Decisions

### D1 三视图 Tab + 保留高级表格（而非重写整页）

`/netdisk-index` 顶部改为四个 Tab：`目录清理` / `未映射收件箱` / `单节收敛` / `高级表格`。前三个是新界面，第四个是现有实现原样保留（加一列「学生可见」）。默认打开「单节收敛」，因为那是价值最高的高频任务。

**为什么不用单一界面**：三种任务的粒度天然不同（目录 / 文件 / 节），塞在一个表格里必然要靠按钮堆叠，这正是当前问题的来源。

**备选**：向导（wizard）逐步推进——否决，管理员经常需要来回跳转，向导的状态机反而更重。

### D2 目录聚合在服务端用路径前缀计算

新增 `getDirectoryStats()`：读取 `status=active` 的索引记录，按 `path` 的第 4、5 段（`教辅材料/8. 教辅资料/教辅资料合集`）聚合，返回 `{dir, total, teacher, studentOrBoth, kinds}`，按 total 降序，内存缓存 60 秒。

**为什么不用新表**：目录不是实体，随时会随扫描变化；用 `startsWith` 派生即可，避免引入需要同步的冗余表。

**备选**：SQL `GROUP BY substr(path,1,N)`——需要写原生 SQL 且窗口长度不固定，收益仅在一次查询快几百毫秒，不值得。5 万行内存聚合实测 < 300ms。

### D3 目录批量操作用 `path startsWith`

新增 `POST /api/netdisk-index/directories/action`，body `{dir, action: 'archive'|'ignore'|'restore'}`，服务层用 `updateMany({ where: { path: { startsWith: dir + '/' }, status: { not: 'ignored' } } })`。`dir` 必须以 `/apps/高中学习系统` 开头，否则 400。

**为什么用前缀而不是新字段**：路径是唯一事实来源，前缀天然覆盖子目录；不需要回填数据。

**风险**：目录名末尾斜杠处理。约定：入库前 trim 末尾 `/`，再拼接比较。

### D4 单节收敛的候选推荐复用现有打分器

新增 `GET /api/netdisk-index/sections/:id/convergence`，返回：
- `mapped`: 该节已挂资源（含 `isPinned`、`status`）
- `candidates`: `sectionId is null` 的 active 资源，用 `computeVideoCandidates`（video）/ `computeCandidates`（其他）对该节标题打分 ≥ 3 的前 20 条，附 `reason`（命中的关键词）
- `metrics`: `{pinned, visible, more, ok}`，直接复用 `sectionConvergence` 的统计口径

**为什么单独建接口**：现有 `/assets?sectionId=` 只返回已挂载资源，看不出"还有哪些没收进来"。候选推荐是收敛视图的核心。

**备选**：前端拉全量未映射再本地打分——否决，前端要实现一套打分规则，规则一改就漂移。

### D5 学生端预览复用 `getSectionResources`

预览面板直接调用 `learning-service.getSectionResources(sectionId, 'featured')` 与 `'more'` 的计数，而不是前端模拟。这样"预览"和"学生真实看到"永远同源。

### D6 撤销用后端内存快照（60 秒 TTL）

执行 `ignore` / `unmap` / 目录批量的 `ignore` 前，服务端记录受影响记录的旧值 `{id, sectionId, mapSource, mapConfirmed, isPinned, status}`，返回 `undoToken`；前端显示 5 秒撤销条，调 `POST /api/netdisk-index/undo/:token` 恢复。

**为什么不用新表**：撤销是短时窗口行为，重启导致失效可接受；避免为瞬时状态引入需要清理的表（项目此前已清理过一批死表）。

**风险**：内存增长。限制单次快照 ≤ 5,000 条、同时保留 ≤ 10 个 token，超限丢弃最旧。

### D7 「学生可见」由后端计算并下发

列表接口为每条资源增加 `visibility` 字段：`visible` / `unmapped` / `unconfirmed` / `teacher` / `archived` / `ignored`。前端只负责渲染徽章，不再自行推导规则。

**为什么后端算**：可见性规则是业务语义，散落到前端会导致两处不一致（此前"状态列"就是这类问题的结果）。

## Risks / Trade-offs

| 风险 | 缓解 |
|---|---|
| 目录聚合在 5 万行上每次 300ms | 60 秒内存缓存 + 目录清理页手动刷新 |
| 前缀批量误伤（目录名是别的前缀） | 强制 `dir + '/'` 精确前缀；确认弹窗显示受影响条数；提供撤销 |
| 撤销快照占用内存 | 单次 ≤ 5,000 条、最多 10 个 token、60 秒过期 |
| 管理员仍用高级表格误操作 | 危险操作（屏蔽/解除映射）统一移入「⋯」次级菜单并二次确认 |
| 候选推荐质量参差 | 候选仅作建议，不自动落库；界面标注命中的关键词供判断 |

## Migration Plan

1. 仅新增接口与前端界面，无 schema 变更、无数据迁移
2. 上线顺序：后端（新增路由）→ 前端；旧接口保持不变，回滚只需回滚镜像
3. 若目录批量出现误操作：用「目录清理」的 `恢复`（restore）或撤销接口修复；必要时 `updateMany` 回滚脚本

## Open Questions

- 目录清理是否需要"按年份过滤"（只归档 2024/2025）？可在目录行内加年份 chip，不改变本期结构，留待使用反馈后决定
