# Design — study-session-analytics

## Context

见 `proposal.md — Why`。现状约束：

- `learning_events` 现有类型 `heartbeat` / `asset_open` / `video_progress` / `download` / `login`，`getOverview` 的 `studySec` 由 heartbeat 累加，`videoSec` 由 video_progress 累加
- 客户端 `useStudyHeartbeat` 全局计时（学生侧 App 根节点），与具体资源无关
- `ResourceViewer` / `NetdiskBrowser` 已具备打开、播放、下载三类上报
- 学生端页面无任何统计入口，统计接口均 `requireAdmin`

## Goals / Non-Goals

**Goals**
- 学习时长只来自"打开资源后的有效学习行为"，主页停留不再计入
- 管理员能回答三个问题：看了哪些视频、看到什么程度、覆盖了哪些章节
- 复用现有事件表与接口，不新增表

**Non-Goals**
- 不做学习节奏热力图、沉默学生告警、加权参与分（用户明确不做）
- 不统计无法内嵌阅读的 Word/PPT 的阅读时长
- 不引入汇总表或离线批处理

## Decisions

### D1 删除全局心跳

删除 `useStudyHeartbeat`、`study-context`、`heartbeat` 事件类型与 `studySec` 计算。工作台、章节地图、学科页都不再产生时长。

**为什么**：主页与列表页没有学习内容，停留时长会把"挂着页面"算成学习，且无法归属到任何章节。

### D2 用 `asset_session` 取代 `asset_dwell` 与 `video_progress`

每次"打开资源 → 关闭查看器"产生一条 `asset_session`：

```
{ type: 'asset_session', sectionId, assetId, durationSec: 停留秒数,
  meta: { kind, name, playSec, position, duration } }
```

视频的 `playSec` 是实际播放秒数，`durationSec` 是可见停留秒数（通常 ≥ playSec）。
下载后即离开的 Word/PPT 不产生 session。

**为什么**：一条事件同时回答"待了多久"和"看了多少内容"，避免两套事件对不齐。
**备选**：保留 video_progress 定期上报——否决，会产生大量碎片记录，且关闭时的补报仍不可或缺。

### D3 视频指标以播放秒数为准

- 视频观看时长 = Σ `meta.playSec`
- 单视频完成度 = Σ playSec ÷ duration（上限 100%）
- 视频完成率 = 完成度 ≥ 90% 的视频数 ÷ 观看过的视频数

**为什么**：停留可能包含暂停、走开，播放秒数才反映真实观看。

### D4 覆盖与回访基于资源集合

- 覆盖小节数 = 区间内 `asset_session` 或 `asset_open` 出现的 distinct `sectionId`
- 学科覆盖率 = 覆盖小节数 ÷ 该学科 `Section` 总数
- 回访资源数 = 区间内 `asset_open` 次数 ≥ 2 的 distinct `assetId`

**为什么**：这两个指标对"学得广不广、哪些材料反复用"最敏感，且不需要额外采集即可从现有事件算出。

### D5 护栏在客户端与服务端双层

客户端：会话 < 5 秒丢弃；视频停留 ≤ 时长 × 1.2；文档停留 ≤ 1800 秒；页面隐藏期间不计时。
服务端：`durationSec` 夹 0–7200，`meta.playSec` 夹 0–video duration（缺 duration 时夹 0–7200）。

**为什么**：客户端可以伪造，服务端必须兜底；但客户端夹取能避免明显异常数据入库。

### D6 下载只记录不计时长

`download` 事件保留（含 sectionId / assetId / name），用于明细与次数统计；任何时长与覆盖率计算都排除该类型。

### D7 历史数据处理

- `heartbeat`、`video_progress`、`asset_dwell` 三类历史事件不再参与统计
- 迁移脚本 `DELETE FROM learning_events WHERE type IN ('heartbeat','video_progress','asset_dwell')`
- 保留 `asset_open` / `download` / `login` 历史，可继续用于回访与下载明细

## Risks / Trade-offs

| 风险 | 缓解 |
|---|---|
| 学生打开视频不播放也会产生停留时长 | 时长与观看分开统计，看板同时展示 playSec 与停留，异常可辨识 |
| 关闭浏览器时 session 未上报 | `pagehide` / `visibilitychange` 立即 flush；仍未送达时保底每 60 秒补报一次 |
| 文档停留在 PDF iframe 中无法感知内部滚动 | 只统计查看器可见停留，不声称"阅读页数" |
| 旧统计页列名变化让管理员困惑 | 概览表列头明确写「内容学习时长」，并加一行说明"仅统计打开资源后的学习" |

## Migration Plan

1. 后端：新增指标计算、清理历史事件、接口字段更名（`studySec` → `contentSec`，同时保留 `studySec` 兼容一个版本）
2. 前端：移除心跳、改造查看器上报、看板列替换
3. 回滚：代码回滚即恢复旧口径；事件表只增不删（除已清理的三类），无 schema 变更

## Open Questions

无（视频进度补报频率 60 秒已定，若后续发现数据缺口大再调）
