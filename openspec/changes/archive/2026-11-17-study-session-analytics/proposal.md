## Why

现有统计以「页面级心跳」累加学习时长：工作台、章节地图这些没有学习内容的页面也被计入，章节详情页又把心跳与资源停留重复相加，导致「有效学习时长」既偏高又无法解释来源。学生真正的学习发生在**单个资源**上（打开视频、看 PDF、下载讲义），统计口径应当以资源为单位。

## What Changes

- **删除全局心跳采集**（`useStudyHeartbeat`、`study-context`、`heartbeat` 事件），工作台/章节地图不再计时；「有效学习时长」指标移除
- 新增**资源会话事件** `asset_session`：一次资源观看/阅读从打开到关闭为一个会话，记录可见停留秒数、实际播放秒数、播放位置、总时长
- 视频时长以**实际播放秒数**为主指标；可内嵌阅读的文档（PDF/图片）以可见停留计时；docx/pptx 等只能下载的资源只记下载与打开
- 采集护栏：单次会话 <5 秒丢弃；视频会话停留上限 = 视频时长 ×1.2；文档会话上限 30 分钟
- 分析看板新增四项：**视频观看进度分布**、**章节覆盖统计**、**资源回访统计**、**资料下载记录**
- 历史 `heartbeat` / `video_progress` 事件停止计入并清理

## Capabilities

### New Capabilities
（无）

### Modified Capabilities
- `learning-analytics`: 事件类型收敛为资源会话；「有效学习时长」被「内容学习时长」取代；看板新增进度分布、覆盖、回访、下载记录
- `chapter-learning`: 资源查看器埋点改为资源会话上报（含播放秒数与停留秒数）

## Impact

- 后端 `backend/src/services/learning-analytics-service.ts`：事件类型与上限、会话指标聚合（内容时长/播放时长/完成率/覆盖/回访/下载明细）、看板数据结构
- 后端 `backend/src/routes/learning.ts`：事件接口接受的类型调整
- 前端 `frontend/src/hooks/useStudyHeartbeat.ts`、`frontend/src/services/study-context.ts`：删除
- 前端 `frontend/src/App.tsx`：移除心跳挂载
- 前端 `frontend/src/components/ResourceViewer.tsx`、`NetdiskBrowser.tsx`：统一为资源会话上报
- 前端 `frontend/src/pages/ChapterDetail.tsx`：移除 study-context 依赖
- 前端 `frontend/src/pages/LearningAnalytics.tsx` + `.css`、`frontend/src/services/learning-api.ts`：指标与展示重构
- 数据：无 schema 变更；清理历史 `heartbeat` / `video_progress` 事件
