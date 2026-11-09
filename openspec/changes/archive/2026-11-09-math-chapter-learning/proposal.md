## Why

现有系统已经跑通「整卷导入 → 发布 → 学生线下作答 → 上传答题纸 → 教师批注打分」这条主线，但学生的入口仍然是"一堆试卷"，而不是"我要学哪一章"。同时网盘里 13,254 份教辅资料（~276 GB）按出版社组织，与学生的教材进度之间没有映射关系，学生面对的是出版社目录而不是学习路径。

本变更把系统的主轴从**题目/试卷**换成**教材章节**：学生进入数学 → 册 → 章 → 节，在每一节里看视频、读讲义、做练习、做试卷，做完的错题回溯到同一节。v1 面向的班级已无需继续服务，因此这是一次面向 v2 的结构性重写，而不是在旧结构上继续叠加。

## What Changes

### 一、建立章节轴（系统第一等公民）

- 新增 `Textbook` / `Chapter` / `Section` 三级模型，以**人教版 A 版数学**为唯一初始教材版本：5 册 / 19 章 / 约 90 节。
- 章节轴成为学生端与资源组织的唯一骨架；学科（`Subject`）仍是切换器维度，先只启用数学。
- 新增章节管理（管理端）：册/章/节的增删改与排序。

### 二、网盘资源索引（不搬文件）

- 新增 `NetdiskAsset` 表，对 `/apps/高中学习系统` 下的 13,254 份文档 + 611 个视频建立**索引记录**（fsId / path / name / ext / size / mtime + 分类字段），**不下载、不复制文件到本地**。
- 自动打标签：`assetKind`（lecture / ppt / answer / practice / exam / plan / audio / video / image / junk）、`audience`（student / teacher / both）、`year` / `region` / `series`。
- 自动章节映射（依据文件名与路径中的章节、知识点关键词），映射准确率预期 ~75%，`mapSource=auto` 的记录必须经人工确认。
- 新增映射工作台（管理端）：按章节筛选未映射资源、批量映射、标记精选（`isPinned`）、归档旧版（`status=archive`）、屏蔽广告/垃圾（`status=ignored`）。
- 旧版（2024/2025）、教师侧、广告图片默认不进入学生视图。

### 三、学生端章节化学习（5 个页面）

- **我的学习**（工作台）：继续上次学习的章节、待做试卷、错题提醒。
- **数学章节地图**：册 ▸ 章 ▸ 节，显示每节的资源密度与错题数。
- **章节详情**：精选视频（3-5 个）+ 讲义/知识清单 + 练习 + 本章试卷，其余资源折叠在「更多资源」。
- **我的试卷**：下载整卷 → 线下作答 → 上传答题纸（拍照或 Word）→ 查看批注与得分。
- **错题本**：保留现有"学生自主录入"能力，新增按章节聚合。

### 四、既有能力挂到章节轴

- `VideoResource.sectionId`、`ExamPaper.sectionId`、`StudentWrongQuestion.sectionId` 三个可空外键。
- 模拟考试（整卷）发布时可选章节，学生端按章节过滤。
- 视频资源支持按章节浏览与筛选（仍走 NetdiskBrowser + 流代理，不搬文件）。

### 五、移除/下架失效模块 **BREAKING**

- **移除难度分类**：题目未结构化，`DifficultyAdjustment` 与难度统计空转。
- **移除自动出卷**：题库组卷在整卷主线中无使用场景，考试创建改为"从试卷库选整卷"。
- **下掉在线测验**：移除 `ExamSession mode=online` 的逐题作答路径，只保留 `mode=whole_paper`。
- **下架知识点文档**：`KnowledgePoint` 文档的导入、列表、编辑器入口全部移除（数据表暂时保留，不做破坏性删表）。
- **旧题库管理与题目列表降级**：拆分导入与题目列表入口移到「系统设置 → 高级工具」，学生端完全不可见。

### 六、交付方式 **BREAKING**

- v1 停止对外服务（用户已确认现有班级无需继续使用）。
- 在同一仓库开 `v2` 分支做结构性重写，复用同一数据库、同一 git 历史、同一 OpenSpec 归档；不打tag 之外的破坏性操作。
- 保留并原样搬移三个高价值资产（不重写）：网盘接入（OAuth/流代理）、MinerU 解析链路、答题纸 Canvas 批注。

## Capabilities

### New Capabilities

- `chapter-taxonomy`: 教材/章/节三级章节轴的定义、人教版 A 数学初始数据、章节管理（增删改排序）与章节树查询。
- `netdisk-index`: 网盘资源索引（NetdiskAsset）的建立、扫描、自动分类（assetKind / audience / 年份 / 地区 / 系列）、自动章节映射与人工确认、精选/归档/屏蔽、按章节查询资源。
- `chapter-learning`: 学生端章节化学习入口——我的学习工作台、章节地图、章节详情（精选资源 + 更多资源）、统一资源阅读器。

### Modified Capabilities

- `admin-dashboard`: 导航与工作台按 v2 定位重组（学生端 5 页 / 管理端 5 页）；旧题库管理、题目列表、难度管理入口移入「系统设置 → 高级工具」，学生端不可见。
- `exam-taking`: 移除在线逐题作答（`mode=online`）的全部行为要求，仅保留整卷考试的学生端行为；整卷考试可按章节过滤。
- `mock-exam`: 整卷模拟考试增加章节维度——发布时选择章节、学生端按章节筛选、考试与试卷可回溯所属章节。
- `paper-library`: 试卷增加章节归属（`sectionId`），试卷库支持按册/章/节筛选与批量挂章节。
- `video-library`: 视频资源增加 `sectionId` 与章节筛选；章节详情页按章节取精选视频；播放仍通过网盘流代理，不落本地。
- `wrong-question-collection`: 错题增加可空 `sectionId`，新增按章节聚合视图与"本节薄弱"提示；学生自主录入流程保持不变。

### Removed Capabilities

- `difficulty-classification`: 题目不再结构化，难度评估与人工调整无实际使用场景。
- `auto-exam-generation`: 自动组卷被"从试卷库选整卷"取代。
- `knowledge-point-management`: 知识点文档功能下架（用户明确不需要）。
- `knowledge-point-import`: 知识点文档导入功能随文档功能一并下架。

## Impact

### 代码

- **后端**：新增 `textbook` / `chapter` / `section` / `netdisk-asset` 路由与 service；`video-library` / `paper-library` / `mock-exam` / `wrong-questions` / `exam-sessions` 增加 `sectionId` 维度；移除 `difficulty`、`exams`（自动出卷部分）、`knowledge-points` 路由注册。
- **前端**：删除 `DifficultyManagement`、`ExamGeneration`、`KnowledgePoint*`（管理/导入/编辑）页面；新增 `MyLearning`、`ChapterMap`、`ChapterDetail`、`ChapterManagement`、`AssetMapping`；改造 `Workbench`、`MockExam`、`PaperLibrary`、`VideoLibrary`、`WrongQuestionBook`、`Sidebar`。
- **复用不改**：`netdisk-service`（OAuth + 流代理）、`mineru-service`、`answer-sheets`（Canvas 批注 + Word 回传）、`auth` / `permission` / `subjects` / `students` / `classes`。

### 数据

- 新增表：`textbooks`、`chapters`、`sections`、`netdisk_assets`。
- 新增可空外键：`video_resources.section_id`、`exam_papers.section_id`、`student_wrong_questions.section_id`。
- 不删既有表；知识点文档、难度、自动出卷相关的表与数据保留（只下线代码路径）。
- 索引：`netdisk_assets(section_id, asset_kind, status)`、`netdisk_assets(netdisk_path)` 唯一。

### 交付与运维

- v1 停服；`v2` 分支开发，`main` 打 `v1-final` tag 冻结。
- 网盘扫描是长任务（13k 文件、限流），必须支持断点续扫与后台执行。
- 前端阅读器约束：PDF 走 `/api/netdisk/stream`（支持 Range）；`.doc/.docx/.pptx` 只提供下载，禁止 iframe 内嵌。

### 风险

- 章节映射准确率约 75%，自动结果必须人工确认，否则学生会看到错位资源。
- 13k 文件按 90 节分配，平均每节 46 个资源，必须依赖精选 + 折叠 + 归档三层收敛，否则章节详情页不可用。
- 章节轴一旦上线即成事实标准，后续新增教材版本（人教B、北师大）需要 `edition` 字段扩展，初期不支持多版本并行。
