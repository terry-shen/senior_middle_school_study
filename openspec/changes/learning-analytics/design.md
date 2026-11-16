# Design — learning-analytics

## Context

现有信号：`sessions`（登录）、`student_asset_opens`（打开，每生上限 200）、`student_learning_progress`（最后学习位置）。无时长、无视频进度、无下载记录。学生规模当前为个位数，SQLite 单库，管理端与学生端同源部署。

## Goals / Non-Goals

**Goals**
- 用最少埋点得到可信的"有效学习时长"与"视频观看量"
- 管理端一屏看懂"谁在学、学多久、卡在哪"
- 数据可回溯、可扩展（未来加答题行为只需新增 type）

**Non-Goals**
- 不做点击热力图、滚动深度、屏幕录制等重埋点
- 不做学生端自我统计（用户明确仅管理员可见）
- 不做实时推送/告警通知，只做查询展示

## Decisions

### D1 单表事件流 `LearningEvent`（不建会话表）

字段：`studentId`、`type`、`sectionId?`、`assetId?`、`durationSec`、`meta(JSON)`、`createdAt`；索引 `(studentId, createdAt)` 与 `(createdAt)`。

会话由心跳间隙推导（间隔 >120 秒视为新会话），不单独存 `LearningSession`。**理由**：会话是派生概念，存表需要额外写入与清理；派生的定义以后可以改而不迁移数据。

### D2 心跳只上报"可见期累计秒数"

客户端每 30 秒检查 `document.visibilityState === 'visible'`，累计秒数，定期 `POST /api/learning/event`。服务端把 `durationSec` 夹在 0–60，防止伪造超长。

**备选**：服务端按"收到心跳即计 30 秒"——否决，网络抖动会使时长偏低，且无法区分页面切走的瞬间。

### D3 视频进度用实际播放秒数，不用打开时长

`ResourceViewer` 监听 `timeupdate`，按 `currentTime` 差值累加（暂停不计），每 15 秒上报一次，附 `{position, duration}`。完成率 = 该资源累计播放秒数 ÷ 视频时长（取所有 progress 事件的 `duration` 最大值）。

**理由**：这是区分"点开就关"与"真的看完"的唯一可靠信号。

### D4 下载双记录（客户端 + 服务端）

`/api/netdisk/file?mode=attachment` 由服务端记录一次 `download`（能防客户端漏报）；客户端额外上报用于关联 `assetId`。去重策略：同一学生同一资源 60 秒内只保留一条（查询时按分钟聚合）。

### D5 统计接口按需聚合，不建汇总表

`GET /api/learning/analytics/overview?from&to` 与 `.../students/:id?from&to` 均直接 `groupBy` 聚合。当前数据量（个位数学生、日均数百事件）毫秒级。

**备选**：`DailyStudyStat` 物化表——留待学生数上千后再引入；届时只需在查询层加一层缓存，不影响数据模型。

### D6 时区固定 Asia/Shanghai

按天/小时聚合统一用 `+08:00` 偏移计算，避免服务器 UTC 导致"凌晨学习"错位。实现上在 Node 侧把 `createdAt` 转成本地日期字符串再分组。

### D7 保留期 180 天

查询接口默认只看最近 90 天；超期数据由后续维护脚本清理（本期不实现定时任务，文档记录即可）。

## Risks / Trade-offs

| 风险 | 缓解 |
|---|---|
| 客户端可伪造心跳（刷时长） | 服务端夹住单次 ≤60 秒；统计页注明"客户端上报，仅供参考" |
| 标签页切走时漏报 | `visibilitychange` 时立即 flush 一次 |
| 事件表增长 | 180 天保留策略 + `(studentId, createdAt)` 索引 |
| SQLite 并发写 | 事件写入为单条 insert，无事务竞争；必要时后续换 WAL |
| 视频完成率被倍速播放影响 | 按实际播放秒数计，1.5 倍速会更快达成 100%，可接受 |

## Migration Plan

1. `prisma db push` 新增 `learning_events` 表（无破坏性变更）
2. 后端先上线上报接口（老前端不调用即无数据），再上线前端埋点
3. 回滚：删除表或停止查询即可，不影响学习主流程

## Open Questions

- 是否需要"沉默学生告警"（7 天零时长标红）？可在概览表加一列，不改变本期结构
