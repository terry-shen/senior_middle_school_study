# Tasks: 系统菜单拆分与考试表合并

> 实施说明：43/43 完成。任务 1.3 与 5.9（ExamPaper.status 4→2 态简化）已按 design.md 决策 3
> + 风险预案（前端用 editedMarkdown 派生编辑状态）实施完成，实施方式见对应条目附注。

## 1. DB schema 重构

- [x] 1.1 schema.prisma: 新建 ExamSession 模型（id/title/mode/source/content/paperId?/totalScore/duration/startTime?/endTime?/status/creatorId/createdAt/updatedAt，@@index([mode,status])/@@index([paperId])/@@index([creatorId])）
- [x] 1.2 schema.prisma: 新建 ExamSubmission 模型（id/examSessionId/studentId/mode/answers?/totalScore?/status/submittedAt?/gradedAt?/gradedBy?/createdAt/updatedAt，@@unique([examSessionId,studentId])/@@index([studentId])/@@index([status])）
- [x] 1.3 schema.prisma: ExamPaper.status 简化为 pending/published（删除 uploaded/editing/split_preview/completed）
  - 实施说明：按 design.md 决策 3 + 风险预案实施。① DB 迁移：291 张试卷全部 status→'pending'；
    ② 后端 papers.ts 删除 4 态写入（import 创建改 'pending'、markdown 保存不再置 editing、split-preview 不再置 split_preview）；
    ③ paper-library.ts publish→置 'published'、unpublish→重置 'pending'（2 态生命周期由发布动作驱动）；
    ④ schema 注释更新为 `// pending, published`；⑤ 编辑工作流状态改由前端按 editedMarkdown 存在性派生（见 5.9）。
- [x] 1.4 schema.prisma: 删除 GeneratedExam/MockExam/Exam/ExamRecord/AnswerRecord 5 个模型；Student 模型更新反向关系（实际删除 7 个旧模型：另含 ExamAssignment/MockExamAnswer；AnswerSheet 改 examSessionId 关联）
- [x] 1.5 迁移脚本 migrate-exam-tables.cjs: 备份 dev.db → MockExam→ExamSession(mode=whole_paper) → Exam+ExamRecord→ExamSession+ExamSubmission → GeneratedExam→ExamSession(source=auto) → 状态映射 → prisma db push --accept-data-loss
  - 实施偏差：7 张旧表仅含 E2E 测试数据、无生产数据需迁移，故直接 `prisma db push --accept-data-loss` 执行
    （备份 dev.db.bak-20260904-160827 已存在）；迁移已落地，一次性脚本无后续价值，未编写。

## 2. 后端 service 重写

- [x] 2.1 新建 exam-session-service.ts: createExamSession（mode/source/content/paperId 选择）/getExamSession/listExamSessions（按 mode/status/creator/student 筛选）/publishExamSession/cancelPublish/startExamSession（创建 ExamSubmission 或关联 AnswerSheet）/saveAnswer（更新 ExamSubmission.answers）/submitExamSession（自动判分选择题）/getExamSessionResult/getExamSessionHistory
  - 实际函数集：createExamSession/previewExamSession/publishExamSession/unpublishExamSession/startExamSession/saveAnswer/submitExamSession/getExamSessionById/listExamSessions/listExamSessionsForStudent/getStudentSubmission/getExamQuestions/getGradingStats/adjustGrade/deleteExamSession/toggleMark/getExamSessionResult/getBenchmarkAnalysis/listExamSubmissions
- [x] 2.2 重写 exam-generation-service.ts: selectQuestions 不变；generateExam 改为创建 ExamSession(source=auto,mode=online,content=题ID数组) 替代 GeneratedExam；previewExam 不变；saveAsTemplate/generateFromTemplate 适配（generateExam 移至 exams.ts 代理内调 createExamSession；service 保留 selectQuestions/previewExam/saveAsTemplate/getTemplates/getTemplateParams）
- [x] 2.3 重写 grading-service.ts: 从 ExamSubmission.answers 读取答案判分；batchGrade 适配；adjustGrade 写回 answers JSON；getGradingStats 查 ExamSubmission
- [x] 2.4 重写 mock-exam-service.ts → 合并到 exam-session-service.ts（mode=whole_paper 分支）；deleteMockExam → cancelPublishExamSession（旧 service 文件已删除；取消发布实现为 unpublishExamSession）
- [x] 2.5 exam-service.ts → 合并到 exam-session-service.ts（mode=online 分支）（旧文件已删除）
- [x] 2.6 wrong-questions-service.ts: 新增 getStudentWrongQuestionsForAdmin(studentId) + getStudentMasteryOverviewForAdmin(studentId)

## 3. 后端 routes 重写

- [x] 3.1 新建 exam-sessions.ts: POST / (创建,requireAdmin)/GET / (列表,requireAuth)/GET /:id/POST /:id/publish(requireAdmin)/DELETE /:id/publish(requireAdmin)/POST /:id/start(requireAuth)/POST /:id/answer(requireAuth)/POST /:id/submit(requireAuth)/GET /:id/result/GET /history/all(requireAuth)
  - 实际路由集：POST /(创建,/preview)、GET /(admin分页)、/grading-stats、/:id/submissions、POST /:id/batch-grade、/:id/publish、/:id/adjust-grade、/:id/grade-answer、GET /:id、DELETE /:id、GET /student/all、POST /:id/start、GET /:id/questions、POST /:id/answer、POST /:id/mark/:questionId、POST /:id/submit、GET /:id/record、GET /:id/result、GET /:id/benchmark；unpublish 为 POST /:id/unpublish
- [x] 3.2 exams.ts → 改为代理路由转发到 exam-sessions.ts（兼容旧路径/api/exams→/api/exam-sessions）（保留 POST /generate[响应含 mockExamId 兼容]、/preview、templates list/create/:id/generate）
- [x] 3.3 mock-exams.ts → 改为代理路由转发到 exam-sessions.ts mode=whole_paper（文件已删除，兼容层在前端 mock-exams-api.ts 实现）
- [x] 3.4 grading.ts: 适配 ExamSubmission；/grade/:recordId→/grade/:submissionId；/batch/:examSessionId（另支持 /adjust 双 body 形式 examSessionId+studentId 或 submissionId）
- [x] 3.5 wrong-questions.ts: 新增 GET /student/:studentId(requireAdmin) + GET /student/:studentId/mastery-overview(requireAdmin)
- [x] 3.6 index.ts: 注册 exam-sessions 路由；保留 exams/mock-exams 代理（旧 mock-exams/online-exams 注册已删除）
- [x] 3.7 后端 npm run build 编译通过

## 4. 前端 API 服务重写

- [x] 4.1 新建 exam-sessions-api.ts: createExamSession/getExamSessions/getExamSession/publishExamSession/cancelPublish/startExamSession/saveAnswer/submitExamSession/getExamSessionResult/getExamSessionHistory + 类型定义（unpublish 用 POST；含学生函数 listExamSessionsForStudent/startExamSession/getExamSessionQuestions/saveExamSessionAnswer/submitExamSession/getExamSessionRecord/getExamSessionResult/getExamSessionBenchmark/toggleAnswerMark）
- [x] 4.2 重写 exams-api.ts → 改为调用 exam-sessions-api（兼容旧函数名）（精简为 generateExam/previewExam + 类型，其余旧函数随 ExamGeneration 页删除）
- [x] 4.3 重写 mock-exams-api.ts → 改为调用 exam-sessions-api（mode=whole_paper）（兼容代理保留全部旧签名；MockExam 接口含 mode/source/paper/paperId/studentScore/answered/studentSubmission；getMockExamResult/getBenchmarkAnalysis 做响应映射；导出 MockExamResult/BenchmarkAnalysis）
- [x] 4.4 重写 grading-api.ts: 适配 ExamSubmission 字段（adjustGrade 改 POST /grading/adjust body {submissionId,newScore,feedback}；batch/grade/stats URL 兼容）
- [x] 4.5 wrong-questions-api.ts: 新增 getStudentWrongQuestionsForAdmin/getStudentMasteryOverviewForAdmin

## 5. 前端页面重构

- [x] 5.1 App.tsx: 导航重构为 5 下拉菜单（试卷管理/题目管理/学生管理/考试管理/系统设置）+ 难度管理移入题目管理 + 自动出卷入口移除（dashboard 卡片同步更新；/exams 重定向 /mock-exams）
- [x] 5.2 MockExam.tsx: 创建流程合并自动组卷(source=auto,mode=online) + 整卷选择(source=library,mode=whole_paper) 两种选项；学生端考试列表统一来自 ExamSession（三来源 tab：手动创建/题库自动组卷/试卷库整卷；浏览器验证全通过）
- [x] 5.3 删除 ExamGeneration.tsx（功能合并到 MockExam.tsx 创建流程）；App.tsx 移除路由和 lazy import（ExamGeneration.tsx/.css 已删除；exams-api.ts 同步精简）
- [x] 5.4 OnlineExamManagement.tsx: 适配 ExamSession API（mode=online 筛选）
- [x] 5.5 TakeExam.tsx: 适配 ExamSession + ExamSubmission.answers 保存逻辑（API token-first 换序、pending 状态判断、createdAt 剩余时间、AnswerSheetUpload scene examSessionId、startExam 兼容 {session,submission}）
- [x] 5.6 GradingReview.tsx: 适配 ExamSubmission 字段（输入框 label 改「考试ID(examSessionId)」；adjustGrade 走 submissionId 形式）
- [x] 5.7 新建 AdminWrongQuestionView.tsx: 复用 WrongQuestionBook 卡片+掌握度概览（只读，隐藏编辑/删除/重练/录入按钮）+ 学生选择器
  - 实施偏差：入口为学生列表行内「错题本」按钮 → /admin/students/:id/wrong-questions（按 URL studentId 加载，未做页内学生选择器；与 design 决策「学生列表进入」一致）
- [x] 5.8 PaperLibrary.tsx: 「发布考试」按钮适配 ExamSession API（mode=whole_paper）（后端 paper-library publish 已改调 createExamSession+publishExamSession，响应兼容 mockExamId+examSessionId，前端无需改动即工作；回归验证通过）
- [x] 5.9 QuestionBank.tsx: 移除「自动出卷」入口（如有）；列表 status 适配 pending/published
  - 实施说明：getStatusText 改 2 态映射（待处理/已发布）；行操作改为 编辑校准(始终)+预览拆分(始终)+
    确认导入(仅 paper.editedMarkdown 存在时，按 design 风险预案从 editedMarkdown 派生编辑状态)；
    删除 legacy「拆分题目」按钮及 handleSplit/splitting state/splitQuestions import；
    papers-api ExamPaper.status union 收敛为 'pending'|'published'。
    浏览器验证：7 行全部「待处理」徽章 + 编辑校准/预览拆分/确认导入/元数据/删除 按钮正确。
    （该页本无自动出卷入口，无需移除）

## 6. 学生侧菜单调整

- [x] 6.1 App.tsx 学生导航: 移除「在线测验」独立入口；整合到「模拟考试」主入口（学生看到的考试列表统一来自 ExamSession，含 online 和 whole_paper 两种模式，按 mode 区分「在线答题」和「下载试卷」）（浏览器验证：学生 /mock-exams 在线卷显示「开始考试」、整卷显示「下载试卷/上传答题纸」；studentLinks 与 studentFeatures 均已移除在线测验）

## 7. 清理

- [x] 7.1 后端: 删除 exam-generation-service.ts 中 GeneratedExam 相关代码；删除 mock-exam-service.ts 中 MockExam 相关代码；删除 exam-service.ts 中 Exam/ExamRecord/AnswerRecord 相关代码（exam-service.ts/mock-exam-service.ts 整文件删除）
- [x] 7.2 前端: 删除已废弃的页面/API 引用；grep 确认无残留 GeneratedExam/MockExam/ExamRecord/AnswerRecord 引用（后端 grep prisma.exam|mockExam|generatedExam|examRecord|answerRecord|examAssignment|mockExamAnswer = 0；前端无 /api/mock-exams|/api/online-exams 直调、无 getAnswerRecords/uploadImageAnswer 残留）

## 8. 验证

- [x] 8.1 后端 npm run build 编译通过
- [x] 8.2 前端 npm run build 构建通过
- [x] 8.3 重启后端 + health 200
- [x] 8.4 E2E 整卷闭环: 试卷库导入→发布为 ExamSession(mode=whole_paper)→学生下载→上传 AnswerSheet→老师 Canvas 批改→学生看批改
  - API 级验证：paper-library publish→ExamSession(mode=whole_paper,status=published,paperId 关联)→学生 student/all 可见(hasPaper=true)→unpublish 清理，全通过。
    答题纸上传/Canvas 批改/学生查看链路已在 paper-library-restructure 变更完成 E2E；answer-sheets 路由已适配 examSessionId（兼容旧参数名），回归 API 200。
- [x] 8.5 E2E 在线闭环: 自动组卷→ExamSession(mode=online)→学生在线答题→提交→AI 批改→学生看成绩
  - API E2E 全通：/exams/generate(201,ExamSession source=auto)→publish→学生 student/all 可见→questions(options 已解析数组)→start→saveAnswer→submit(status=graded)→grading/stats→batch grade。测试数据已清理。
- [x] 8.6 E2E 错题本 admin: 学生列表→某学生错题本→只读视图→掌握度概览（浏览器：/students 行内「错题本」→ /admin/students/2/wrong-questions 只读页加载；admin 只读 API 200 total/overview 正常）
- [x] 8.7 E2E 菜单: 5 下拉菜单全部可访问；自动出卷入口已移除；难度管理在题目管理下（浏览器验证 toggles=[试卷管理,题目管理,学生管理,考试管理,系统设置]；admin 卡片无自动出卷；/exams 重定向 /mock-exams；学生端仅「学习」下拉）
- [x] 8.8 回归: 试卷库/题库管理/题目列表/错题本学生端/答题纸阅卷 不受影响（API 回归：papers?purpose=question_source=7、questions/all total=33、answer-sheets/pending 200、grading/stats 200、paper-library list 200、split-preview 可用）
