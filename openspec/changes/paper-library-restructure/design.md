## Design

### Decision 1: 试卷库作为独立功能区（新增路由 + 页面）

**决策**：新建 `routes/paper-library.ts` 后端路由 + `pages/PaperLibrary.tsx` 前端页面，整卷相关查询/导入/发布/回收全部聚合在此。原 `/papers` 路由拆分为 `/paper-library`（整卷）和 `/question-bank`（拆分来源），原 PaperImport.tsx 重构为题库管理页（仅拆分导入）。

**理由**：用户反馈"整卷与拆分交融在一起让人无法理解"。独立功能区让两条工作流物理隔离，职责清晰。

**替代方案**：在原 PaperImport 内加 tab 切换整卷/拆分——rejected，tab 切换仍混杂在同一页面，且 URL 不变无法直接定位。

**影响**：
- 后端：新建 routes/paper-library.ts；routes/papers.ts 的 import-whole / import-whole-multiple / download-file 路由可保留（前端调用路径不变）或迁移到 paper-library 路由（更清晰）。推荐迁移：将整卷相关路由移到 paper-library.ts，papers.ts 仅保留拆分来源相关。
- 前端：新建 PaperLibrary.tsx；PaperImport.tsx 改名 QuestionBank.tsx；App.tsx 路由调整。

### Decision 2: ExamPaper 加 subject + school 字段

**决策**：schema.prisma 的 ExamPaper 模型加 `subject String?` + `school String?`，并加 `@@index([subject, year, region])` 复合索引支持多维筛选。

**学科枚举**：语文/数学/英语/物理/化学/生物/政治/历史/地理/理综/文综/其他（12 种）。后端 paper-metadata-service.ts 的 EXAM_TYPE_KEYWORDS 扩展为 SUBJECT_KEYWORDS，从文件名识别学科关键字。

**理由**：用户明确要求按学科/学校分类管理。学科用枚举便于筛选和统计分布；学校为自由文本（学校名称无法穷举）。

**替代方案**：学科用单独 Subject 表——rejected，12 种枚举用 String 字段足够，无需独立表。

### Decision 3: 发布动作创建 MockExam（而非 Exam）

**决策**：试卷库的"发布考试"按钮创建 MockExam（paperId 关联 ExamPaper，questionIds=[]，standard=custom，自动分配全部学生）。学生通过 MockExam 模拟考试页面看到该考试并下载试卷。

**理由**：
- MockExam 已有 paperId 字段（whole-paper-publish 加的）
- MockExam 已有限时/答题卡/对标分析能力，整卷场景复用
- 在线测验（Exam）是题目级在线答题场景，整卷是线下场景，不应混用
- AnswerSheet 已支持 mockExamId 关联，回收批改链路已就绪

**替代方案**：创建 Exam（purpose=whole_paper）——rejected，Exam 是在线测验场景，学生进入后期望在线答题，整卷无题目会显示空白崩溃（此前 TakeExam 整卷模式是 hack）。MockExam 更适合线下场景。

### Decision 4: 回收批改 tab 集成进试卷库

**决策**：PaperLibrary.tsx 顶部 tab 切换"试卷管理 / 回收批改"。回收批改 tab 调 AnswerSheet API（GET /pending?status=submitted）按 MockExam 分组显示回收进度，点击进入 AnswerSheetDetail 批注阅卷。

**理由**：用户要求"发布→回收→批改"闭环在一个功能区内完成。AnswerSheet 已实现完整批注阅卷能力（Canvas 批注 + 评分 + 评语 + Word 批改版上传），试卷库只需聚合查询展示，无需重复实现。

**替代方案**：回收批改独立成新页面——rejected，割裂生命周期。

### Decision 5: PaperImport 重构为题库管理（仅拆分导入）

**决策**：原 PaperImport.tsx 移除整卷导入入口（整卷导入/文件夹整卷导入按钮）、移除整卷行操作（发布/下载文件）、移除 purpose 筛选。页面改名"题库管理"，URL 从 /papers 改为 /question-bank。原 /papers 路由重定向到 /question-bank（兼容旧链接）。

**理由**：PaperImport 当前承载两种工作流导致用户困惑。重构后职责单一：仅拆分导入（MinerU 解析+编辑校准+拆分入库）。

**影响**：
- 前端：PaperImport.tsx → QuestionBank.tsx（或保留文件名改组件名+标题）；移除 WholePaperImport 入口、整卷行操作
- App.tsx：路由 /papers → /question-bank（保留 /papers 重定向）；/papers/import-whole 移除（整卷导入在 /paper-library）
- WholePaperImport.tsx 可保留（被 PaperLibrary 复用）或合并进 PaperLibrary

### Decision 6: 学生端 MockExam 整卷模式

**决策**：MockExam.tsx 学生端列表对 questionIds 为空的整卷模拟考试显示"下载试卷"按钮（替代"开始考试"）；点击进入考试详情页时，TakeExam（或新建 MockExamTaking 页）检测 questionIds 为空后渲染整卷模式（下载 + 答题纸上传，不渲染在线答题界面、不计时）。

**理由**：现有 MockExam.tsx 已有学生列表 + 结果页 + 答题/批改流程。加整卷模式判断即可复用，无需新建独立页面。

**替代方案**：新建 MockExamTaking 整卷考试页——rejected，与现有 MockExam 页面割裂，学生需在两个入口切换。

## Risks

- **140 张已有整卷数据迁移**：现有 whole_paper 数据无 subject/school 字段。可通过试卷库的元数据编辑功能逐张补充，或写脚本根据文件名批量提取 subject（数学/英语等关键字）。低风险（字段可空）。
- **MockExam 与 Exam 双系统并存**：MockExam（整卷+模拟）和 Exam（在线测验）两套系统并存可能让管理员困惑。文档需明确：整卷发布走试卷库→MockExam；在线测验（题目级）走 /online-exams→Exam。中风险（需用户引导）。
- **PaperImport 重构影响现有用户习惯**：用户已习惯 /papers 入口。重定向到 /question-bank 可缓解。低风险。
- **MockExam 整卷模式不创建题目级答题记录**：现有 MockExamAnswer 表无记录，对标分析/错题分析等依赖题目的功能在整卷场景不可用。这是预期行为（整卷是线下场景，对标分析改为基于 AnswerSheet 批改得分）。低风险。

## Migration

- **DB**：`npx prisma db push` 加 subject/school 字段 + 索引（纯新增，不破坏现有数据）
- **后端**：
  - 新建 `routes/paper-library.ts`（聚合查询 + 发布 + 回收进度）
  - `routes/papers.ts`：整卷相关路由（import-whole/import-whole-multiple/download-file）迁移到 paper-library.ts（或保留并代理调用，推荐迁移）
  - `services/paper-metadata-service.ts`：加 SUBJECT_KEYWORDS + autoExtractMetadata 返回 subject
  - `services/mock-exam-service.ts`：createMockExam 支持 paperId + 整卷模式（questionIds=[] 跳过 selectQuestionsForMockExam）
  - `index.ts`：注册 paper-library 路由
- **前端**：
  - 新建 `pages/PaperLibrary.tsx` + `.css`（试卷管理 tab + 回收批改 tab）
  - `pages/PaperImport.tsx` → `pages/QuestionBank.tsx`（移除整卷入口）
  - `pages/MockExam.tsx`：学生端列表加整卷模式判断（下载按钮）
  - `pages/TakeExam.tsx`：整卷模式渲染判断（或新建 MockExamTaking 复用 AnswerSheetUpload）
  - `services/papers-api.ts`：加 subject/school 字段；新增 paper-library API 函数
  - `services/mock-exams-api.ts`：MockExam 加 paperId 字段
  - `App.tsx`：路由 /paper-library + /question-bank + /papers 重定向 + nav 调整
- **数据迁移脚本**：可选——写 cjs 脚本扫描 140 张 whole_paper 的 title 提取 subject 关键字批量更新
