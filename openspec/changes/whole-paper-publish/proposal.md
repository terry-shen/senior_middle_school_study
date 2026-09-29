## Why

当前系统的试卷导入流程强制走"MinerU 解析 → 拆分校准 → 入库"链路，对于"我已有现成试卷、只想直接发给学生考试"的场景是过度工程。管理员需要一条轻量路径：导入整张试卷原始文件（PDF/Word），填写元数据，一键发布给学生下载打印，线下纸笔考试。成绩不回系统（D 方案）。同时保留现有拆分导入链路不变，作为题库补充习题的来源，两条路径在 UI 上明确分开。

## What Changes

- **新增"整卷导入"入口**：管理员上传 PDF/Word 文件 + 填写元数据（标题/年份/地区/考试类型/总分/时长），系统存储原始文件，不触发 MinerU 解析或题目拆分。
- **ExamPaper 新增 `purpose` 字段**：`whole_paper`（整卷考试用，只存文件）/ `question_source`（拆分入库用，走现有流程）。**BREAKING**：现有 ExamPaper 默认 `question_source`。
- **整卷发布机制**：整卷导入后，管理员点"发布" → 创建一条 Exam 记录（questionIds 为空数组，关联 ExamPaper.purpose=whole_paper）→ 分配给学生/班级。
- **学生侧在线测验列表整合**：学生看到的 Exam 列表统一数据源。questionIds 非空 → 显示"进入考试"按钮（在线答题）；questionIds 为空 → 显示"下载试卷"按钮（下载原始 PDF/Word 文件，线下考试）。
- **拆分导入入口保留不变**：现有 PaperImport 页面、MinerU 解析、autoTagQuestions、SplitPreview 校准、confirm-import 全部保留，仅 UI 上与整卷导入分开（两个独立按钮/页面）。
- **成绩闭环**：整卷考试的成绩不回系统。错题本/掌握度/学习激励仅覆盖在线测验部分，不覆盖线下整卷考试。

## Capabilities

### New Capabilities
- `whole-paper-publish`: 整卷导入与发布能力——上传原始试卷文件、填写元数据、发布给学生下载打印、线下考试。

### Modified Capabilities
- `exam-taking`: 在线测验列表需整合整卷下载条目——questionIds 为空的 Exam 显示"下载试卷"按钮而非"进入考试"。

## Impact

- **数据库**：ExamPaper 表新增 `purpose` 字段（String，默认 `question_source`）；Exam 表无结构变更（questionIds 已支持空数组）。
- **后端**：新增整卷导入 API（POST /api/papers/import-whole）、整卷发布 API（POST /api/exams/:id/publish-whole 或复用现有 publish）、文件下载 API（GET /api/papers/:id/download-file）；现有拆分导入路由不变。
- **前端**：管理员侧新增整卷导入页面（与现有 PaperImport 分开）；学生侧 OnlineExamManagement 列表根据 questionIds 是否为空区分"进入考试"/"下载试卷"按钮。
- **现有功能**：自动出卷、在线测验、错题本、AI批改、难度管理、题目列表等依赖 Question 表的功能完全不受影响。
