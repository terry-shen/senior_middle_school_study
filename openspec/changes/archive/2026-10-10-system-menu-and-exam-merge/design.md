# Design: 系统菜单拆分与考试表合并

## Decisions

### Decision 1: 考试表合并方案——GeneratedExam+MockExam+Exam → ExamSession

**Choice**: 将 GeneratedExam、MockExam、Exam 三张表合并为统一的 ExamSession 表。

**Alternatives considered**:
- 保留三表 + 添加 mode 字段区分 → 查询需 UNION，ORM 复杂度高
- 保留 MockExam + 合并 Exam/GeneratedExam → 整卷和在线仍分裂，前端需两套 API

**Rationale**: 用户要求"流程简单，不要太多状态"。三种考试本质上共享相同的生命周期（创建→发布→考试→批改→完成），差异仅在 mode（whole_paper vs online）和 source（library vs auto vs manual）。统一为一张表简化 ORM 查询、前端 API 对接和状态管理。

ExamSession 字段：
- id, title, mode('whole_paper'|'online'), source('library'|'auto'|'manual')
- content: JSON（在线模式=题ID数组，整卷模式=null）
- paperId?: 整卷关联 ExamPaper
- totalScore, duration, startTime?, endTime?
- status('draft'|'published'|'ongoing'|'graded')
- creatorId, createdAt, updatedAt

### Decision 2: 答题记录合并方案——ExamRecord+AnswerRecord → ExamSubmission

**Choice**: 将 ExamRecord + AnswerRecord 合并为 ExamSubmission，answers 为 JSON 数组。

**Rationale**: AnswerRecord 的每题答案天然是 ExamRecord 的子记录，合并为 JSON 减少表 JOIN。整卷模式不创建 ExamSubmission（只关联 AnswerSheet），避免空记录。

ExamSubmission 字段：
- id, examSessionId, studentId, mode('whole_paper'|'online')
- answers?: JSON [{questionId, answer, timeSpent?, score?, feedback?, isCorrect?}]
- totalScore?, status('pending'|'submitted'|'graded')
- submittedAt?, gradedAt?, gradedBy?
- createdAt, updatedAt

### Decision 3: ExamPaper.status 简化——4 态 → 2 态

**Choice**: uploaded/editing/split_preview/completed → pending/published。

**Rationale**: 4 态中 uploaded/editing/split_preview 实际都是"未发布"的子状态（编辑中），用户要求"不要太多状态"。简化为 pending（未发布，含编辑中）和 published（已发布）。前端通过 editedMarkdown 是否存在判断是否已编辑，无需后端状态字段。

### Decision 4: 菜单分组——5 个下拉菜单

**Choice**: 试卷管理、题目管理、学生管理、考试管理、系统设置。

**Rationale**: 用户明确要求"按 4 类拆分"（实际 5 类含系统设置）。难度管理归入题目管理（与题目列表同级），自动出卷归入考试管理→模拟考试→创建（不再独立菜单），学生错题本归入学生管理。

### Decision 5: 自动出卷合并方式——考试管理→模拟考试→创建选项

**Choice**: 自动出卷不再独立菜单/页面，变成「考试管理→模拟考试→创建」流程中的选项之一。

**Alternatives considered**:
- 保留独立菜单但放在考试管理下拉下 → 与模拟考试重叠，用户混淆
- 删除自动出卷功能 → 功能缺失

**Rationale**: 用户要求"先把整试卷录入→出卷→考试→批改→错题流程做完整"。自动出卷是创建考试的一种方式（source=auto, mode=online），与整卷发布（source=library, mode=whole_paper）并列，统一在「模拟考试→创建」入口下选择。

### Decision 6: 错题本 admin 只读视图——复用组件+隐藏按钮

**Choice**: 新建 AdminWrongQuestionView.tsx 路由 /admin/students/:studentId/wrong-questions，复用 WrongQuestionBook 的卡片列表和掌握度概览渲染逻辑，隐藏编辑/删除/重练/录入按钮。

**Rationale**: 用户选方案 (a) admin 完全开放只读访问。后端新增 GET /api/wrong-questions/student/:studentId（requireAdmin），前端复用已有组件降低开发成本。

### Decision 7: 数据迁移——脚本映射旧数据

**Choice**: 编写迁移脚本：MockExam → ExamSession(mode=whole_paper)，Exam+ExamRecord+AnswerRecord → ExamSession+ExamSubmission，GeneratedExam → ExamSession(source=auto)。状态映射：in_progress→ongoing, completed→graded。

**Rationale**: DB 中有历史考试数据（整卷+模拟考试），需保留。迁移脚本用 Prisma 事务，先迁移主表再迁移子表，最后删除旧表。

## Risks

| 风险 | 缓解 |
|------|------|
| 表合并后旧 API 路由 404 | 保留 /api/mock-exams 和 /api/online-exams 路由作为代理转发到 /api/exam-sessions |
| ExamSubmission.answers JSON 查询性能 | SQLite JSON 查询有限，按需用应用层过滤；若数据量大可后续迁移 PostgreSQL |
| 状态简化丢失编辑中信息 | 前端通过 editedMarkdown 字段判断编辑状态，无需后端状态 |
| 迁移脚本失败 | 事务回滚 + 先备份 dev.db |

## Migration

1. **DB**: 备份 dev.db → 创建 ExamSession + ExamSubmission 表 → 迁移脚本 → 删除旧表（GeneratedExam/MockExam/Exam/ExamRecord/AnswerRecord）→ ExamPaper.status 简化
2. **Backend**: 新建 exam-session-service.ts → 重写 exam-generation-service.ts（输出 ExamSession）→ 重写 exam-service.ts + mock-exam-service.ts → exam-sessions.ts 路由（合并 exams.ts + mock-exams.ts）→ grading-service.ts 适配 ExamSubmission → wrong-questions.ts 新增 admin 端点
3. **Frontend**: App.tsx 导航 5 下拉 → MockExam.tsx 创建流程合并自动组卷+整卷 → OnlineExamManagement.tsx + TakeExam.tsx 适配 ExamSession → 新建 AdminWrongQuestionView.tsx → 删除 ExamGeneration.tsx（功能合并到 MockExam.tsx）
