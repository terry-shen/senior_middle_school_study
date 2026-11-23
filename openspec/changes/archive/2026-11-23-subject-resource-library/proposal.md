## Why

各学科页目前只有「视频主线课程」。网盘索引里有 25,600 条学生可见但未映射的资源，其中数学 5,019 条，覆盖步步高、5.3、必刷题等成套教辅。它们已经在索引里，却没有入口，学生只能看到视频主线。

这些资源不适合直接写 `sectionId` 映射：数学资源中候选章节匹配分 ≥4 的只有 371 条，93% 没有可靠的小节归属，强行映射会污染教材小节。需要的是与视频主线并列的只读「教辅资源」大类，按系列、书目、类型和年份归集展示。

## What Changes

- 新增学生端「教辅资源」API：按学科返回未映射、学生可见的资源，按系列/书目分组，支持类型、年份、搜索和分页
- 学科页在「视频主线课程」之外增加并列的「教辅资源」分类，数学、物理、化学、生物、语文、英语均已整理
- 不修改 `sectionId`、`mapSource` 或 `mapConfirmed`；资源被管理员映射后自然从该大类消失
- 只展示 `status=active`、`audience in (student,both)` 的资源；教师专属、junk、下架资源不进入
- 资源按学习主线统计：教材小节 / 视频主线 / 教辅资源线 / 未归主线；教辅资源线计入已映射
- 资源卡片支持直接打开现有 ResourceViewer，复用视频、PDF、图片和下载能力

## Capabilities

### New Capabilities

- `resource-library`: 学科级「教辅资源」目录，按系列/书目归集未映射资源，提供筛选、搜索与分页

### Modified Capabilities

- `chapter-learning`: 学科页增加与「视频主线课程」并列的「教辅资源」分类；学科可进入性计入未映射资源数量

## Impact

- 后端：`services/learning-service.ts` 新增资源库查询与分组；`routes/learning.ts` 新增接口
- 前端：`services/learning-api.ts` 类型与请求；`pages/ChapterMap.tsx` 新增分类与列表；`ChapterMap.css` 样式
- 数据：无 schema 变更；只读查询现有 `netdisk_assets`
- 性能：按学科缓存分组结果，文件列表分页，避免一次返回 5,000 条
