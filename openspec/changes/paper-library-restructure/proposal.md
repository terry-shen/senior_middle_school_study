## Why

当前整卷导入与拆分导入共用 `/papers` 页面，两种工作流（"存原始文件供下载打印" vs "MinerU 解析拆分入库"）交融在同一列表与操作集里，管理员心智负担重、系统使用方式难以理解。整卷试卷也缺少学科/学校等关键分类维度，140 张 2010 年高考卷混在一起无法按学科/省份筛选，"发布→学生作答→回收→批改"的完整生命周期被打散到多个不相关页面。

需要把整卷作为一条完整生命周期独立成"试卷库"功能区：导入→分类管理→发布考试→回收批改，全程闭环不与拆分导入混杂。

## What Changes

- **新增"试卷库"功能区（PaperLibrary）**：整卷导入（单文件/文件夹递归）+ 按学科/年份/省份/学校/考试类型多维筛选 + 列表管理 + 一键发布 + 回收批改 tab，全程在一个功能区内闭环
- **ExamPaper 新增 `subject` 和 `school` 字段**：学科用枚举（语文/数学/英语/物理/化学/生物/政治/历史/地理/理综/文综/其他），学校为自由文本；自动提取时从文件名识别学科关键字
- **发布动作改为创建 MockExam**（而非当前的 Exam/在线测验）：整卷 → MockExam(paperId) → 学生在"模拟考试"页看到 → 下载试卷线下作答 → 上传答题纸 → 老师批注阅卷。复用 MockExam 已有的限时/答题卡/对标分析能力
- **回收批改 tab 集成进试卷库**：试卷库内显示每张已发布卷子的学生回收进度（已上传/未上传）+ 直接进入答题纸批注页
- **原 PaperImport 页重构为"题库管理"**：移除整卷入口（整卷导入/文件夹整卷导入/整卷发布），仅保留拆分导入（MinerU 解析+编辑校准+拆分入库），职责单一
- **BREAKING**：整卷的发布流程从 `/online-exams?paperId=` 改为试卷库内直接创建 MockExam；原 OnlineExamManagement 中的整卷模式移除
- **BREAKING**：`/papers` 路由拆分为 `/paper-library`（整卷）和 `/question-bank`（拆分来源），原 `/papers` 重定向

## Capabilities

### New Capabilities
- `paper-library`: 试卷库独立功能区——整卷导入（单文件/文件夹递归）、多维元数据分类筛选（学科/年份/省份/学校/考试类型）、列表管理、一键发布为模拟考试、回收进度监控、批注阅卷入口

### Modified Capabilities
- `exam-paper-import`: 试卷元数据扩展——新增 subject（学科枚举）和 school（自由文本）字段；自动提取逻辑从文件名识别学科关键字；整卷导入入口从 PaperImport 移到试卷库；拆分来源试卷的导入保留在题库管理页
- `mock-exam`: 整卷发布关联——MockExam 新增 paperId 关联 ExamPaper(purpose=whole_paper)；学生参加整卷模拟考试时下载原始试卷；考后上传答题纸走 AnswerSheet 流程
- `exam-taking`: 整卷考试学生端——学生参加整卷模拟考试时显示下载试卷+上传答题纸入口（复用现有 TakeExam 整卷模式，但场景从 Exam 切换为 MockExam）

## Impact

- **数据库**：ExamPaper 加 `subject String?` + `school String?` 字段 + 索引；MockExam 已有 paperId 字段无需改动；AnswerSheet 已有 mockExamId 字段无需改动
- **后端**：
  - 新建 `routes/paper-library.ts`：聚合查询（多维筛选）+ 发布（创建 MockExam + 自动分配学生）+ 回收进度统计
  - `routes/papers.ts`：import-whole / import-whole-multiple 移到 paper-library 路由（或保留并加 subject/school 入参）
  - `services/paper-metadata-service.ts`：autoExtractMetadata 加学科关键字识别
  - `services/mock-exam-service.ts`：createMockExam 支持 paperId + 整卷模式（questionIds 为空）
- **前端**：
  - 新建 `pages/PaperLibrary.tsx` + `.css`：整卷功能区主页（导入区+筛选区+列表+发布弹窗+回收tab）
  - `pages/PaperImport.tsx` 重构：移除整卷入口，改名题库管理，仅保留拆分导入
  - `pages/MockExam.tsx`：学生端列表显示整卷模拟考试 + 下载入口 + 上传答题纸入口
  - `App.tsx`：路由 `/paper-library` + `/question-bank`（原 `/papers` 重定向）+ nav 调整
- **迁移**：现有 140 张 whole_paper 数据保留，可通过试卷库的元数据编辑功能批量补充 subject/school
- **依赖**：复用 AnswerSheet 批注阅卷系统（已实现）、MockExam 限时/答题卡/对标分析（已实现）
