## Context

当前系统所有试卷导入都走 MinerU 解析 + 拆分校准流程，产出的 Question 记录支撑在线测验/错题本/AI批改等学生侧功能。对于"已有现成试卷、只需发给学生下载打印"的场景，强制拆分是过度工程。本变更新增一条轻量路径：整卷导入 → 存原始文件 → 发布 → 学生下载。两条导入路径在 UI 和 API 上完全分离。

现有架构关键点：
- ExamPaper 表已有 pdfUrl/rawContent/parsedMarkdown/editedMarkdown 等字段，拆分导入流程使用后三者；整卷只用 pdfUrl + 元数据。
- Exam 表用 questionIds（JSON 数组）关联题目。整卷场景 questionIds=[]，复用 Exam 表统一数据源，学生列表无需合并多个查询。
- publishExam 已有空参自动分配所有学生的逻辑（exam-service.ts）。
- 学生侧 OnlineExamManagement.tsx 已按角色分流（admin 管理视图 / 学生列表视图）。

## Goals / Non-Goals

**Goals:**
- 管理员能通过独立入口导入整卷文件（PDF/Word）+ 元数据，不触发任何拆分逻辑。
- 整卷能发布为 Exam 记录并分配给学生，学生能在测验列表看到并下载原始文件。
- 拆分导入入口和现有所有依赖 Question 的功能完全不受影响。
- 学生测验列表统一数据源（Exam 表），前端按 questionIds 是否为空区分"进入考试"/"下载试卷"。

**Non-Goals:**
- 不实现线下考试成绩回录（D 方案：成绩不回系统）。
- 不实现整卷的在线答题（整卷只下载，不在线作答）。
- 不改造拆分导入流程或 MinerU/question-splitting-service。
- 不实现整卷的 AI 批改或答题记录。
- 不做试卷格式转换（上传什么格式就下载什么格式）。

## Decisions

### Decision 1: ExamPaper 加 purpose 字段（而非新建表）
**选择**: ExamPaper 表新增 `purpose String @default("question_source")` 字段。
**理由**: 整卷和拆分来源共用 ExamPaper 的元数据字段（title/year/region/examType/totalScore/duration），只差用途。新表会重复字段且增加维护成本。
**备选**: 新建 `WholePaper` 表 — 拒绝，因为元数据重复且发布时仍需映射到 Exam。

### Decision 2: 整卷发布复用 Exam 表（questionIds=[]）
**选择**: 整卷发布 = 创建 Exam 记录，questionIds 设为空数组字符串 `"[]"`，关联 ExamPaper.purpose=whole_paper。
**理由**: 学生侧 OnlineExamManagement 已查 Exam 表返回列表。整卷复用 Exam 表后，学生列表无需合并两个数据源，前端只需判断 `questionIds.length === 0` 区分按钮。
**备选**: 整卷不走 Exam，学生列表合并 ExamPaper(purpose=whole_paper) — 拒绝，因为需要前端合并两个不同 shape 的数据源，复杂度更高且分页困难。

### Decision 3: 整卷导入与拆分导入 API 完全分离
**选择**: 新增 `POST /api/papers/import-whole`（整卷导入）和 `POST /api/papers/import`（现有拆分导入，不变）。
**理由**: 两个流程的语义完全不同（一个存文件、一个解析拆分），共用端点会导致分支逻辑复杂。分离后每个端点职责单一。
**备选**: 共用 `/import` 加 `purpose` 参数分支 — 拒绝，因为后端逻辑耦合且前端 UI 已分离。

### Decision 4: 整卷发布复用现有 publishExam 逻辑
**选择**: 整卷发布走 `POST /api/online-exams/:id/publish`（现有路由），后端创建 Exam + ExamAssignment。整卷导入后先创建 Exam 草稿（questionIds=[]），再发布。
**理由**: publishExam 已有空参自动分配所有学生、创建 ExamAssignment 的逻辑，整卷可直接复用。
**备选**: 新增 `POST /api/papers/:id/publish-whole` — 可接受但增加端点数。如果现有 publish 路由对 questionIds=[] 有校验拦截，则走新端点。

### Decision 5: 整卷文件下载走 papers 路由
**选择**: 新增 `GET /api/papers/:id/download-file`（返回 ExamPaper.pdfUrl 的原始文件）。现有 `GET /api/papers/:id/download-source` 是给拆分流程用的源文件下载，语义重叠但用途不同（一个给管理员校准用、一个给学生下载用）。学生侧的下载按钮调 download-file。
**理由**: 学生权限不同于管理员，download-source 有 requireAdmin，学生无法访问。新端点用 requireAuth（学生可访问）。
**备选**: 改 download-source 为 requireAuth — 拒绝，因为拆分校准流程的源文件下载应限管理员。

### Decision 6: 前端整卷导入页面与拆分导入页面分开
**选择**: 新增 `WholePaperImport.tsx` 页面（文件上传 + 元数据表单），路由 `/papers/import-whole`。现有 `PaperImport.tsx` 不动。试卷管理页面（/papers）顶部显示两个按钮分别跳转。
**理由**: 两个流程的 UI 完全不同（整卷只需上传+表单，拆分需要 MinerU 进度+拆分预览+校准编辑器），混在一个页面会产生大量条件分支。

### Decision 7: 试卷列表区分整卷和拆分来源
**选择**: PaperImport.tsx 的试卷列表表格加"用途"列（整卷/拆分来源），整卷行显示"发布/下载文件/删除"按钮，拆分来源行显示现有"编辑校准/预览拆分/确认导入/下载源文件"按钮。
**理由**: 管理员需要一目了然区分两类试卷，且操作按钮完全不同。

## Risks / Trade-offs

- **[整卷文件安全]** 学生下载端点 requireAuth 但不限试卷归属 — 任何登录学生都能下载任何已发布整卷。**Mitigation**: 只允许下载已发布（Exam.status=published）且该学生已被分配（ExamAssignment）的整卷。
- **[文件体积]** 大 PDF（几十 MB）存 uploads/ 可能占磁盘。**Mitigation**: multer 限制文件大小（如 50MB），后续可考虑对象存储。
- **[Word 文件下载兼容性]** Word 文件下载后学生可能用 WPS/旧版 Office 打开排版异常。**Mitigation**: 不做格式转换，上传什么下载什么；建议管理员上传 PDF。
- **[purpose 字段迁移]** 现有 ExamPaper 无 purpose 字段，迁移默认 question_source。**Mitigation**: `prisma db push` 添加可空/默认字段，不影响现有数据。

## Migration Plan

1. schema.prisma 加 purpose 字段（String, default 'question_source'），`npx prisma db push`。
2. 后端新增 `/api/papers/import-whole` POST 端点 + `/api/papers/:id/download-file` GET 端点。
3. 后端 papers.ts 试卷列表查询 include purpose 字段；列表 API 按需过滤 purpose。
4. 前端新增 WholePaperImport.tsx 页面 + 路由。
5. 前端 PaperImport.tsx 试卷列表加"用途"列 + 整卷操作按钮。
6. 前端 OnlineExamManagement.tsx 学生列表按 questionIds 是否为空区分按钮。
7. 前端 TakeExam.tsx 对整卷 Exam（questionIds=[]）显示"下载试卷"而非答题界面。
8. 回滚：删除新端点/页面，purpose 字段保留不影响现有功能。
