## 1. 后端：资源库查询

- [x] 1.1 `learning-service.ts` 增加学科未映射资源计数与缓存，`listLearningSubjects` 返回 `resourceCount`
- [x] 1.2 实现系列与书目推导，无法识别归「其他资料」
- [x] 1.3 实现 `getResourceLibrarySummary`：active + student/both + sectionId null，返回类型/年份分布与系列/书目计数
- [x] 1.4 实现 `getResourceLibraryAssets`：按 series/book/kind/year/q 过滤并分页

## 2. 后端：路由

- [x] 2.1 新增 `GET /learning/resource-library/summary` 与 `/assets`
- [x] 2.2 参数校验与 limit/page 夹取

## 3. 前端：学科页分类

- [x] 3.1 `learning-api.ts` 增加资源库类型与请求函数
- [x] 3.2 `ChapterMap.tsx` 增加「视频主线课程 / 教辅资源」标签，`resourceCount>0` 可进入
- [x] 3.3 教辅资源标签支持系列/书目折叠、类型/年份筛选、搜索、加载更多
- [x] 3.4 点击资源复用 `ResourceViewer`，`sectionId` 为 null
- [x] 3.5 `ChapterMap.css` 增加标签、筛选条、分组与移动端样式

## 4. 验证

- [x] 4.1 后端构建、前端构建与 lint 通过
- [x] 4.2 数学 summary 5019、步步高 1723、分页一致、映射字段未改动
- [x] 4.3 浏览器实测数学：切教辅资源、类型筛选、搜索「函数」、展开分组、打开 PDF
- [x] 4.4 视频主线回归正常

## 5. 学习主线口径

- [x] 5.1 新增 `computeLearningLine`：section / video / library / unassigned
- [x] 5.2 `getStats` 返回 `byLine`、`sectionMapped`，`unmapped` 改为未归主线
- [x] 5.3 工作台与资源映射页改为教材小节 / 教辅资源线 / 视频主线 / 未归主线；学生文案改为「教辅资源线」
- [x] 5.4 教辅资源排除视频主线资源与中考/初中/小学路径；补充高考解密/试题调研/小题狂做/高考必刷卷/解题觉醒等系列规则
- [x] 5.5 六个学科分科验证，恢复后数学 6155、物理 4195、化学 2556、生物 2590、语文 3127、英语 3569
- [x] 5.6 恢复 8,310 条非 junk 忽略资源，junk 1,183 保持 ignored；恢复前已备份 ID 清单

