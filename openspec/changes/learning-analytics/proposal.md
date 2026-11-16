## Why

系统目前只有「登录时间」「打开过哪些资源」「最后学到哪一节」三类信号，无法回答管理员最关心的问题：学生在平台上到底学了多久、视频看了多少、哪一节卡住了。需要一套轻量、可信、仅管理员可见的学习行为统计。

## What Changes

- 新增 `LearningEvent` 事件表（append-only）：心跳、资源打开、视频进度、下载、登录
- 学生端在页面可见期间每 30 秒上报一次心跳（累计秒数），视频播放按实际播放秒数上报，教辅下载由服务端记录
- 新增管理端「学习分析」页面：学生列表（有效时长 / 活跃天数 / 连续天数 / 打开资源数 / 视频完成率 / 最后活跃）+ 单学生详情（每日时长趋势、活跃时段热力图、章节投入 Top、学科占比、最近行为）
- 学生端不展示任何统计页面；所有分析接口仅管理员可访问

## Capabilities

### New Capabilities
- `learning-analytics`: 学习行为事件采集、有效时长计算、按学生/时间/章节/学科的统计与看板

### Modified Capabilities
- `chapter-learning`: 打开章节资源时除记录进度外，还需上报打开事件与观看时长
- `admin-dashboard`: 管理员导航新增「学习分析」入口

## Impact

- 后端：`prisma/schema.prisma` 新增 `LearningEvent`；新增 `services/learning-analytics-service.ts`；`routes/learning.ts` 新增事件上报与统计接口；`routes/netdisk.ts` 在教辅下载时记录事件
- 前端：`services/learning-api.ts` 新增上报与统计函数；新增全局心跳 hook；`ResourceViewer` 上报视频进度与下载；新增 `pages/LearningAnalytics.tsx` + 路由 `/analytics`（requireAdmin）+ 侧边栏入口
- 数据量：每生每日约 100–300 条事件，明细保留 180 天
- 不改学生端可见性规则，不影响既有学习流程
