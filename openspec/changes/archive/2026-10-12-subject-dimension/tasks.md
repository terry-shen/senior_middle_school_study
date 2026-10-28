# Implementation Tasks

## Group 1: DB schema + 迁移

- [x] 1.1 schema.prisma: 新建 Subject 模型（id/code/name/icon/color/order/isActive, code @unique）
- [x] 1.2 schema.prisma: Question/ExamSession/StudentWrongQuestion/KnowledgePoint 加 `subjectId Int?` + 外键关联 Subject + `@@index([subjectId])`
- [x] 1.3 schema.prisma: ExamPaper 加 `subjectId Int?` 外键关联 Subject + `@@index([subjectId])`；删除现有 `subject String?` 字段（实施说明：迁移前临时重命名 subjectLegacy 保列，迁移完成后 db push --accept-data-loss 删除）
- [x] 1.4 新建种子脚本 `backend/seed-subjects.cjs`：插入 12 个预置学科（语文/数学/英语/物理/化学/生物/政治/历史/地理/文综/理综，含 code/name/icon/color/order）（实施说明：spec 文字"12"与枚举列表 11 个不一致，按枚举列表插入 11 个，order 1-11）
- [x] 1.5 `npx prisma db push --accept-data-loss` + `npx prisma generate`（先杀 node 解 DLL 锁）
- [x] 1.6 运行 seed-subjects.cjs 插入 12 学科（实际 11 个，math id=2）
- [x] 1.7 新建迁移脚本 `backend/migrate-subject.cjs`：ExamPaper.subject String? → 查 Subject.code 映射 subjectId；Question/ExamSession/StudentWrongQuestion/KnowledgePoint null subjectId → 数学 ID
- [x] 1.8 运行迁移脚本 + 验证（所有记录 subjectId 非 null）——291 试卷（1 理综映射 science，290 兜底 math）、33 题、1 知识点文档全部填充，0 残留 null

## Group 2: 后端 service + routes

- [x] 2.1 新建 `backend/src/services/subject-service.ts`：getSubjects/createSubject/updateSubject/deleteSubject/checkSubjectInUse
- [x] 2.2 新建 `backend/src/routes/subjects.ts`：GET /（公开）、POST /（requireAdmin）、PUT /:id（requireAdmin）、DELETE /:id（requireAdmin + 409 检查）
- [x] 2.3 index.ts 注册 `/api/subjects` 路由
- [x] 2.4 paper-metadata-service.ts：SUBJECT_KEYWORDS 改为从 Subject 表动态读取（60s 缓存 + DB 不可用时静态兜底）；autoExtractMetadata 改 async 返回 subjectCode/subjectId；单测 9/9 通过
- [x] 2.5 papers.ts：4 个导入路由（import/import-multiple/import-whole/import-whole-multiple）写 subjectId（req.body.subjectId 优先，autoMeta.subjectId 兜底）；GET /、GET /:id/questions、GET /questions/all 加 subjectId query 过滤
- [x] 2.6 exam-generation-service.ts：selectQuestions where 加 subjectId 过滤；previewExam 从 params 读 subjectId
- [x] 2.7 exam-session-service.ts：createExamSession 写 subjectId；listExamSessions/listExamSessionsForStudent 加 subjectId 过滤；exam-sessions.ts 路由透传 query
- [x] 2.8 wrong-questions-service.ts：createWrongQuestion 加 subjectId（手动+拍照路由透传）；getWrongQuestions 加 subjectId 过滤
- [x] 2.9 knowledge-points.ts：POST / / POST /import 写 subjectId；GET / 加 subjectId 过滤（PUT /:id 亦支持）
- [x] 2.10 exams.ts：/generate 与 /preview 强制 subjectId（缺失返回 400「请先选择学科」）；/generate 创建 ExamSession 写 subjectId
- [x] 2.11 papers.ts PUT /:id 元数据更新支持 subjectId 字段（空字符串/null 清除）

## Group 3: 前端 Context + API

- [x] 3.1 SubjectContext 全局学科 Context（subjects 加载/localStorage 恢复/兜底 math）
- [x] 3.2 subjects-api.ts（getSelectedSubjectId/withSubjectParam/getSubjects）
- [x] 3.3 SubjectSwitcher 组件（admin 含全部/学生无全部/切换刷新）
- [x] 3.4 App.tsx SubjectProvider 包裹
- [x] 3.5 Sidebar 集成切换器+学科管理入口
- [x] 3.6 10 个 list API 隐式附加 subjectId（withSubjectParam）

## Group 4: 前端页面

- [x] 4.1 SubjectManagement.tsx+css（列表/新增/编辑/启停/删除 409）
- [x] 4.2 /subjects 路由 requireAdmin
- [x] 4.3 QuestionBank+PaperLibrary 导入学科下拉（5 个导入 API 加 subjectId 参数）
- [x] 4.4 KnowledgePointImport 学科下拉（uploadWordDocument 加 subjectId）
- [x] 4.5 MockExam CreateMockExamForm 学科选择+generateExam/createMockExam 传 subjectId
- [x] 4.6 WrongQuestionEdit 学科下拉（create+update 透传 subjectId）
- [x] 4.7 PaperLibrary 元数据模态框 subject 改 subjectId 下拉（列表/详情 include subject 对象）
- [x] 4.8 系统名更新（Login.tsx/index.html title 改高中学习系统）

## Group 5: 验证

- [x] 5.1 后端 tsc 通过（元数据单测 9/9）
- [x] 5.2 前端 vite 构建通过 319ms
- [x] 5.3 后端重启 health 200
- [x] 5.4 API 验证 14/14（subjects 11/papers 过滤 290/preview 无学科 400 带学科 200/paper-library filters 对象数组/CRUD+409/wrong-questions/knowledge-points 过滤）
- [x] 5.5 浏览器验证（切换器 admin 全部+11、学生 11 项无全部；切换持久化；试卷库学科列显示；学科管理页 11 行）
- [x] 5.6 学科管理 CRUD 验证（浏览器表单 + API 全链路 14/14）
- [x] 5.7 回归（admin 11 页 + student 5 页 0 ErrorBoundary 0 console errors；顺手修复 2 个既有 bug：/wrong-questions/stats 400 与 /answer-sheets 集合路由 404）
