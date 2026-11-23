## Why

资源映射工作台目前只有「教材小节」一个目标：`sectionId` 非空即已映射，学生端教辅资源线只能按路径规则自动分组。自动归组会有错误，管理员却无法在映射页把资源改到某个教辅系列/书目，也无法纠正错误的教辅分类。

## What Changes

- `NetdiskAsset` 增加 `librarySeries`、`libraryBook` 两个可空字段，保存管理员手动指定的教辅分类
- 资源映射接口支持两种目标：教材小节（`sectionId`）和教辅资源分类（`librarySeries` + `libraryBook`）
- 手动归入教辅资源时清空 `sectionId` 与精选状态，并把资源恢复为 active
- 教辅资源查询优先使用 `librarySeries` / `libraryBook`，为空时才回退到路径推导
- 资源映射页增加教辅分类调整入口，支持单条和批量设置
- 不改变视频主线的判定；视频资源仍归视频主线

## Capabilities

### New Capabilities

（无）

### Modified Capabilities

- `netdisk-index`: 映射目标从「仅教材小节」扩展为「教材小节 / 教辅资源分类」；单条与批量操作支持教辅分类
- `resource-library`: 教辅资源的系列/书目优先使用管理员手动值，路径推导只作为回退

## Impact

- 数据库：`netdisk_assets` 增加 `library_series`、`library_book`
- 后端：`prisma/schema.prisma`、`netdisk-index-service.ts`、`routes/netdisk-index.ts`、`learning-service.ts`
- 前端：`netdisk-index-api.ts`、`NetdiskMapping.tsx`、`ChapterMap.tsx` 的归组读取
- 无破坏性接口变更；`sectionId` 映射保持兼容
