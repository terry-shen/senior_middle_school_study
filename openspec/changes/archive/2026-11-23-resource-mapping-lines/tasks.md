## 1. 数据与后端

- [x] 1.1 `schema.prisma` 增加 `librarySeries`、`libraryBook`，执行 `prisma db push` 与 `generate`
- [x] 1.2 `learning-service` 的系列/书目优先读取手动字段，为空才回退路径推导
- [x] 1.3 `updateAsset` 支持教辅分类：写系列/书目，清空 `sectionId/isPinned`，置 `status=active`；改回小节时清空教辅字段
- [x] 1.4 `batchAction` 增加 `library` 动作，批量写入系列/书目并清空小节归属
- [x] 1.5 扫描更新不包含教辅字段，手动分类不会被覆盖

## 2. 接口

- [x] 2.1 `PATCH /api/netdisk-index/assets/:id` 接受 `librarySeries/libraryBook`
- [x] 2.2 `POST /api/netdisk-index/assets/batch` 接受 `library` 动作与 `librarySeries/libraryBook`
- [x] 2.3 教辅字段随资源列表返回

## 3. 前端映射页

- [x] 3.1 `netdisk-index-api.ts` 类型与请求参数补齐
- [x] 3.2 未挂小节收件箱增加教辅系列/书目输入与「归入教辅」按钮
- [x] 3.3 批量操作复用同一入口，单条勾选即可调整
- [x] 3.4 资源行显示当前教辅分类

## 4. 验证

- [x] 4.1 后端与前端构建通过
- [x] 4.2 单条归入教辅后 `sectionId` 为空、教辅字段写入、学生端优先按手动值分组
- [x] 4.3 批量归入教辅生效；改回小节会清空教辅字段
- [x] 4.4 扫描保存逻辑不写教辅字段，手动分类不会被覆盖

## 5. 教辅资源映射视图

- [x] 5.1 新增管理端教辅树与教辅资源列表接口，含教师侧资源
- [x] 5.2 映射页新增「教辅资源映射」标签：左侧学科/系列/书目，右侧资源列表
- [x] 5.3 勾选资源后填写目标系列/书目并点击「移动到该分类」
- [x] 5.4 构建通过；浏览器验证树、书目、资源列表和移动入口正常

## 6. 学科覆盖与整体移动

- [x] 6.1 `librarySubject` 字段支持手动覆盖教辅学科，查询优先使用
- [x] 6.2 新增整体移动接口：按学科/系列/书目把全部资源移动到目标学科/系列/书目
- [x] 6.3 映射页增加目标学科选择与「移动整个分类」按钮


