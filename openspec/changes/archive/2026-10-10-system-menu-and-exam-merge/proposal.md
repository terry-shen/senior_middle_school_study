# Proposal: 系统菜单拆分与考试表合并

## Why

当前系统存在三个结构性问题：

1. **管理员菜单扁平混乱**：所有功能入口挤在一个导航栏里，试卷管理、题目管理、学生管理、考试管理、系统设置没有分类边界，用户找不到功能入口。

2. **考试相关表过度分散**：GeneratedExam（自动出卷产物）、MockExam（模拟考试）、Exam（在线测验）、ExamRecord（答题记录）、AnswerRecord（逐题答案）、AnswerSheet（答题纸）6 张表语义重叠，数据流动路径复杂，前端需要同时对接多套 API。

3. **状态字段过多**：ExamPaper 有 4 种状态（uploaded/editing/split_preview/completed），MockExam 和 Exam 各有 4 种状态且命名不一致（in_progress vs ongoing），状态转换逻辑分散在前后端多处。

## What Changes

### 1. 管理员菜单按 4 类拆分

将扁平导航栏拆分为 5 个下拉菜单组：
- **试卷管理**：试卷库（整卷）、题库管理（拆分入口）
- **题目管理**：题库管理（拆分）、题目列表、难度管理
- **学生管理**：学生列表、班级管理、学生错题本（只读，新增）、学习激励看板
- **考试管理**：模拟考试（主入口）、在线测验（逐题，可选）、AI批改（逐题）、答题纸阅卷（整卷 Canvas）
- **系统设置**：模型管理

学生侧菜单同步调整（移除在线测验独立入口，整合到模拟考试主入口下）。

### 2. 考试表合并（5→3）

- **GeneratedExam → ExamSession**：自动出卷产物不再独立存在，出卷直接生成 `ExamSession(source='auto', mode='online', content=题ID数组JSON)`
- **MockExam + Exam → ExamSession**：统一为 `ExamSession(mode='whole_paper'|'online', source='library'|'auto'|'manual', paperId?, content?, status)`，4 态统一（draft/published/ongoing/graded）
- **ExamRecord + AnswerRecord → ExamSubmission**：统一为 `ExamSubmission(examSessionId, studentId, mode, answers? JSON, status)`，3 态（pending/submitted/graded）。整卷模式不创建 ExamSubmission（只关联 AnswerSheet）
- **AnswerSheet 保留不动**：Canvas 批注载体不变

### 3. 状态字段简化

- `ExamPaper.status`：4 态 → 2 态（pending/published）
- `ExamSession.status`：4 态统一（draft/published/ongoing/graded）
- `ExamSubmission.status`：3 态（pending/submitted/graded）
- `AnswerSheet.status`：2 态不变（submitted/graded）
- `StudentWrongQuestion.reviewStatus`：3 态不变（new/reviewing/mastered）

### 4. 自动出卷菜单合并

自动出卷不再独立菜单，变成「考试管理 → 模拟考试 → 创建」里的选项：
- 从题库自动组卷（source=auto, mode=online）
- 从试卷库选整卷（source=library, mode=whole_paper）

### 5. 错题本 admin 只读视图

学生管理 → 学生列表 → 某学生「错题本」按钮 → 只读视图（复用 WrongQuestionBook 组件去掉编辑/删除/重练按钮）。后端新增 `GET /api/wrong-questions/student/:studentId`（requireAdmin）。

### 6. 难度管理归类

难度管理从独立菜单移到「题目管理」下拉下。

## Capabilities

- **MODIFIED** `admin-dashboard` — 菜单 4 分组拆分 + 学生错题本只读入口
- **MODIFIED** `auto-exam-generation` — 自动出卷合并到考试管理，GeneratedExam → ExamSession
- **MODIFIED** `exam-taking` — Exam + ExamRecord + AnswerRecord → ExamSession + ExamSubmission
- **MODIFIED** `mock-exam` — MockExam → ExamSession(mode=whole_paper)，表合并
- **MODIFIED** `answer-grading` — AnswerRecord → ExamSubmission.answers，AI 批改适配
- **MODIFIED** `wrong-question-collection` — 新增 admin 只读视图端点

## Impact

- **DB**: 删除 GeneratedExam、MockExam、Exam、ExamRecord、AnswerRecord 5 张表；新建 ExamSession、ExamSubmission 2 张表；ExamPaper.status 枚举简化
- **Backend**: 重写 exam-service.ts、exam-generation-service.ts、mock-exam-service.ts、grading-service.ts；新增 exam-session-service.ts；路由合并 exams.ts + mock-exams.ts → exam-sessions.ts
- **Frontend**: App.tsx 导航重构（4 下拉 + 系统设置）；ExamGeneration.tsx 合并到 MockExam.tsx 创建流程；OnlineExamManagement.tsx + TakeExam.tsx 适配 ExamSession；新增 AdminWrongQuestionView.tsx
- **Migration**: 旧数据迁移脚本（MockExam → ExamSession, Exam+ExamRecord → ExamSession+ExamSubmission）；status 映射
