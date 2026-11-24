## Context

当前 `Session` 只保存 token、过期时间和创建时间，退出时直接删除记录，因此没有登录/退出历史，也无法判断空闲或标签页关闭。`requireAuth` 只校验 session 是否存在且未过期；前端 `AuthContext` 只负责恢复 token 和手动退出。现有 `LearningEvent` 记录资源级学习行为，不能直接拿来表示“页面使用时长”。

本次变更需要在现有 Express + Prisma + SQLite 架构内完成，不引入 WebSocket 或新的基础设施。服务端时间是唯一可信时间源，客户端计时只用于提示和触发退出。

## Goals / Non-Goals

**Goals:**
- 保留每次登录的会话历史，记录登录、最后活跃、最后在线、退出时间与退出原因。
- 用活跃心跳累计真实使用时长，空闲、暂停视频和挂机不计入。
- 30 分钟无操作自动退出，29 分钟提醒；视频播放期间豁免。
- 通过在线心跳超时反向判定标签页关闭/断网，默认 3 分钟，允许近似。
- 学习分析展示使用时长与登录/退出记录。
- 保持现有内容学习时长、视频观看、下载、章节覆盖口径不变。

**Non-Goals:**
- 不做 WebSocket/SSE 实时在线状态。
- 不对多设备或同一设备多标签页做使用时长的精确去重；按会话直接相加。
- 不改变 24 小时 JWT 过期机制，空闲退出由会话状态控制。
- 不采集页面内容、鼠标轨迹等隐私数据，只记录心跳时间与累计秒数。
- 不把使用时长混入内容学习时长或视频观看时长。

## Decisions

### 1. 扩展 `Session`，退出不删除记录

给现有 `Session` 增加：

| 字段 | 类型 | 说明 |
|---|---|---|
| `lastActiveAt` | `DateTime` | 最后一次有业务操作/视频播放 |
| `lastSeenAt` | `DateTime` | 最后一次在线心跳或 API 请求 |
| `endedAt` | `DateTime?` | 会话结束时间 |
| `endReason` | `String?` | `manual` / `idle` / `disconnected` |
| `activeSec` | `Int` | 本次会话累计活跃秒数 |

`token` 仍保持唯一。`requireAuth` 的有效条件改为：

```
session 存在
AND endedAt IS NULL
AND expiresAt > now
AND now - lastActiveAt <= 30 分钟
```

超过 30 分钟时，服务端把会话标记为 `idle` 并返回 401；手动退出标记 `manual`；在线心跳超时标记 `disconnected`。**不再删除 Session**，否则登录/退出历史会丢失。

替代方案是新建 `LoginHistory` 表，但会与 token 会话产生两份状态，登出时仍要同步；直接扩展现有 Session 更简单。

### 2. 两种心跳分离：在线心跳与活跃心跳

```
页面打开 ──► presence 心跳（每 60 秒，不管是否操作）
                 └─ 更新 lastSeenAt

用户操作/视频播放 ──► activity 心跳（最多每 60 秒一次）
                 ├─ 更新 lastActiveAt
                 └─ activeSec += min(now - lastActiveAt, 60)
```

两者合并为一个接口：

```
POST /api/auth/heartbeat
{ "active": true | false }
```

`requireAuth` 负责校验会话；`active=false` 只更新 `lastSeenAt`，`active=true` 同时更新 `lastActiveAt` 和累计秒数。这样空闲页面仍保持在线，不会被误判为标签页关闭；只有页面真正消失，presence 才会停。

为什么不把每次业务 API 都当作活跃：后台轮询、资源加载会把挂机时间算进去。活跃只由前端交互或视频播放显式触发，业务 API 只更新 `lastSeenAt`。

### 3. 每日使用时长单独汇总

新增：

```
DailyUsage
  id
  studentId
  date          // YYYY-MM-DD，北京时间
  activeSec
  loginCount
  firstLoginAt
  lastLogoutAt
  @@unique([studentId, date])
```

活跃心跳按北京时间把增量写入当天，跨零点自然拆到两天。登录时 `loginCount + 1` 并补 `firstLoginAt`；退出时更新 `lastLogoutAt`。

不直接把 `Session.activeSec` 按登录日归属，因为一次会话可能跨天；也不使用高频 `LearningEvent` 行存心跳，避免事件表膨胀。

### 4. 服务端兜底清理

新增 `session-sweeper`，每 60 秒扫描：

```
endedAt IS NULL
AND lastSeenAt < now - 3 分钟
    → endedAt = lastSeenAt
      endReason = disconnected
      写 logout 事件
```

`lastSeenAt` 同时由 presence 心跳和普通 API 请求更新，避免后台标签页定时器被浏览器节流时误判。清理必须幂等：只更新 `endedAt IS NULL` 的记录，并且只在本次真正更新成功时写 logout 事件。

空闲退出也由服务端兜底：`requireAuth` 发现 `lastActiveAt` 超过 30 分钟时标记 `idle`。前端 29/30 分钟计时器负责用户体验，服务端负责最终状态。

### 5. 视频活跃检测

`ResourceViewer` 和 `NetdiskBrowser` 的原生 `<video>` 监听：

- `play` / `playing`：标记视频播放中，持续发送 `active: true` 心跳。
- `pause`：取消播放中状态，活动计时停止。
- `ended`：取消播放中状态，从结束时刻开始计算空闲。
- 组件卸载/关闭：取消播放中状态并补一次活跃心跳（若有播放）。

用一个轻量 `ActivityProvider` 暴露 `markActive()`、`setVideoPlaying(boolean)`，避免各组件直接操作全局事件。视频播放中不弹 29 分钟提醒，也不触发 30 分钟退出；暂停或结束后恢复普通空闲逻辑。

视频播放时即使标签页不可见也继续心跳，因为用户可能在听视频；暂停后不可见则正常空闲。

### 6. 多标签页协调

同一浏览器多个标签页共享 localStorage token。为避免一个空闲标签页把另一个正在使用的标签页退出：

- 使用 `BroadcastChannel('auth-activity')` 广播活跃时间；不支持时退回 `localStorage` 时间戳。
- 每个标签页的空闲计时器取所有标签页中最大的 `lastActivityAt`。
- 任一标签页退出时广播 `logout`，其他标签页清理 token 并跳转登录页。
- 多设备不共享 BroadcastChannel，按会话独立计时并相加，符合已确认口径。

### 7. 登录/退出写入最近行为

`LearningEvent` 允许的类型增加 `logout`。登录成功后写一条 `login` 事件；会话结束时写一条 `logout` 事件，`meta` 保存 `sessionId` 与 `reason`。事件写入失败不阻塞登录/退出主流程。

学习分析详情直接复用现有 `recent` 查询，因此登录/退出会自然出现在「最近行为」中；UI 增加 `logout` 标签与原因展示。

### 8. 前端 401 与退出体验

- `AuthContext.logout(reason)` 调用服务端并清除本地 token；`reason` 仅作为提示，服务端对手动退出固定记录 `manual`。
- 心跳返回 401 时，立即清理本地状态并跳转 `/login`，显示“会话已过期或长时间未操作”。
- 对普通业务请求，增加一个轻量 `authFetch` 包装或全局 401 事件：收到 401 时统一清理登录态，避免各页面各自处理。
- 退出提示模态框提供“继续使用”按钮，点击后立即发一次活跃心跳并重置计时。

### 9. 关闭标签页的处理

不依赖 `beforeunload` 立即结束会话，因为刷新、站内跳转、移动端切换都可能误触发。采用：

- `pagehide` / `visibilitychange` 时尽力更新 `lastSeenAt`，不直接结束会话。
- 页面真正关闭后 presence 停止，3 分钟后由 sweeper 标记 `disconnected`。
- 这样刷新页面不会强制重新登录，关闭标签页的退出时间允许有约 3 分钟误差。

## Risks / Trade-offs

- **后台标签页定时器被节流** → presence 间隔 60 秒、离线阈值 3 分钟；普通 API 请求也会刷新 `lastSeenAt`；必要时把阈值配置为 5 分钟。
- **心跳写库频率** → 合并 presence/activity 为一个接口，活跃时每分钟最多一次；`requireAuth` 对 `lastSeenAt` 写入做 30–60 秒节流。
- **SQLite 写竞争** → 心跳只做单行更新 + 每日汇总 upsert；如压力明显，可把 presence 间隔放宽到 90–120 秒，统计精度不受明显影响。
- **多设备重复计时** → 已确认接受；概览中按会话相加，不做去重。
- **会话表增长** → 退出不删除记录，后续可增加 90/180 天清理任务；本次先保留历史，不做自动删除。
- **客户端时钟不可信** → 所有时长增量由服务端计算并限制单次不超过 60 秒；客户端只负责触发。
- **sendBeacon 无法带 Authorization** → 不作为唯一手段；优先 `fetch(..., { keepalive: true })`，失败则依赖 presence 超时。

## Migration Plan

1. 备份生产数据库。
2. `prisma db push` 增加 Session 字段与 `DailyUsage` 表；现有 Session 的 `lastActiveAt`/`lastSeenAt` 使用默认当前时间。
3. 部署后端，启动 sweeper；确认心跳、空闲退出、离线退出接口正常。
4. 部署前端，验证 29 分钟提示、30 分钟退出、视频播放豁免、登录/退出日志。
5. 回滚：前端可回滚到旧版本；后端新增字段为可空或有默认值，旧代码仍可运行。若需完全回滚，保留 DailyUsage 表不影响旧逻辑。

## Open Questions

无。离线判定阈值采用 3 分钟，后续可通过配置调整，不影响规格与任务拆分。
