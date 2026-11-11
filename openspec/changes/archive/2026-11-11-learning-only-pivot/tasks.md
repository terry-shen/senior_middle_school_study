# Tasks — learning-only-pivot

## 1. 备份与数据删除

- [x] 1.1 备份本地 `backend/prisma/dev.db` 到 `backend/prisma/backups/dev-<yyyymmdd>.db`，并记录 `uploads` 各子目录体积
- [x] 1.2 `schema.prisma` 删除 17 个模型（ExamPaper、Question、ExamSession、ExamSubmission、ExamSessionAssignment、AnswerSheet、ExamTemplate、EnrichmentProposal、StudentWrongQuestion、Badge、UserBadge、CheckIn、Challenge、ChallengeParticipant、ChallengeBadge、IncentiveNotification、VideoResource）及全部反向关系；保留 Subject/Textbook/Chapter/Section/Student/Class/Session/NetdiskConfig/NetdiskAsset/NetdiskScanState/StudentLearningProgress/AiAssistant/LLMConfig
- [x] 1.3 杀后端 → `npx prisma db push --accept-data-loss` → `prisma generate` → 校验表数量与核心数据（338 节 / 54,771 资源 / 学生 2 个）

## 2. 后端删除与瘦身

- [x] 2.1 删除路由：papers、paper-library、exam-sessions、exams、grading、answer-sheets、wrong-questions、incentive、difficulty、llm、prompt-template、video-library
- [x] 2.2 删除服务：exam-session、exam-generation、grading、wrong-questions、incentive、paper-images、paper-metadata、question-splitting、mineru、mcq-extractor、pdf、word、text、ocr、upload、quality、export、enricher、question-image、llm-service、prompt-template-service
- [x] 2.3 `learning-service`：删除 getSectionPapers / getSectionWrongQuestions / getLearningMap / getWorkbench；新增 listLearningSubjects / getStudentSubjectProgress / getRecentOpens
- [x] 2.4 `routes/learning.ts`：新增 GET /subjects、GET /recent；删除 /sections/:id/papers、/sections/:id/wrong-questions、/map、/workbench、/map/student/:id
- [x] 2.5 `routes/subjects.ts`：仅保留 GET /，删除 POST/PUT/DELETE 与 usage
- [x] 2.6 `index.ts`：移除全部已删路由注册与 import；`/health` 的 endpoints 清单更新
- [x] 2.7 `netdisk-service.ts`：回调地址改为 `PUBLIC_BASE_URL + /api/netdisk/callback`
- [x] 2.8 grep 清理残留引用（examSubmission / examPaper / wrongQuestion / videoResource / incentive / prisma.question / prisma.examSession 等），`npx tsc --noEmit` 通过

## 3. 前端删除与改造

- [x] 3.1 删除页面与 CSS：PaperLibrary、PaperViewer、QuestionBank、QuestionList、MockExam、AnswerSheetsList、AnswerSheetDetail、WrongQuestionBook/Edit/Practice/Print、LearningIncentive、SubjectManagement
- [x] 3.2 删除 API 客户端：papers-api、exams-api、exam-sessions-api、online-exams-api、mock-exams-api、grading-api、answer-sheets-api、wrong-questions-api、incentive-api、llm-api、video-library-api
- [x] 3.3 `Sidebar.tsx`：admin 仅保留 学习内容（章节学习/章节管理/资源映射/学习资源）、学生管理（学生列表）、系统设置（网盘绑定）；student 仅 工作台/章节学习/学习资源/AI 助理；删除 SubjectSwitcher
- [x] 3.4 `App.tsx`：删除全部已下线路由；对 /paper-library、/question-bank、/questions、/mock-exams、/answer-sheets、/wrong-questions、/incentive、/subjects、/models 等旧路径统一 `<Navigate to="/learning" replace />`
- [x] 3.5 `learning-api.ts`：新增 getLearningSubjects / getRecentOpens / getStudentSubjectProgress；删除 getSectionPapers / getSectionWrongQuestions / getLearningMap / getStudentWorkbench
- [x] 3.6 `ChapterMap.tsx`：顶部加学科 Tab 条（sectionCount 驱动，待建设灰显），移除教材册树与 useSubject 依赖，改用 Tab 选择
- [x] 3.7 `ChapterDetail.tsx`：删除「本节试卷」「本节错题」两块与其请求
- [x] 3.8 `Workbench.tsx`：管理员统计改为册/章/节/资源数；学生改为继续学习 + 我的学科 + 最近打开
- [x] 3.9 `vite build` 通过，grep 确认无已删页面/API 引用

## 4. 本地验证

- [x] 4.1 重启后端 `/health` 200；`GET /api/learning/subjects` 返回 11 学科（4 个 sectionCount>0）
- [x] 4.2 已删端点全部 404（/api/paper-library、/api/exam-sessions、/api/wrong-questions、/api/incentive、/api/papers、/api/llm/models）
- [x] 4.3 学生 `/learning`：4 个可用 Tab + 7 个待建设；切换数学/物理/化学/生物均能加载视频主线与关联小节
- [x] 4.4 学生 `/learning/section/:id`：精选/更多资源正常，无试卷/错题块；视频可播放（206）
- [x] 4.5 学生 `/`：继续学习、我的学科、最近打开三块正常，0 console error
- [x] 4.6 管理员 `/`、`/chapters`、`/netdisk-index`、`/resources`、`/students`、`/settings/netdisk` 正常，0 console error
- [x] 4.7 旧路径重定向：访问 /paper-library 跳 /learning


### 第 1-4 组实施记录

- **1.1** 备份 `backend/prisma/backups/dev-20261111-1146.db`（59MB）；uploads：papers 1,771 文件/294.3MB、answer-sheets 2/3.5MB、knowledge-points 0、wrong-questions 1/0MB。
- **1.2-1.3** schema 34→13 模型：删 17 个业务模型 + 5 个死表（KnowledgePoint/DifficultyAdjustment/PromptTemplate/LLMConfig/LLMCallLog）；新增 `StudentAssetOpen`。`db push --accept-data-loss` 221ms，教材 21 册/90 章/338 节、netdisk_assets 54,771 完好。
- **2.1-2.2** 删除 13 个路由文件、22 个 service 文件（含 `subject-service.ts`）。
- **2.3-2.5** `learning-service` 重写：新增 `listLearningSubjects` / `getRecentOpens` / `getViewedSectionCounts`，删除章节试卷/错题/地图/工作台查询；`routes/learning.ts` 仅 7 个端点；`routes/subjects.ts` 仅 GET /。
- **2.6-2.8** `index.ts` 只注册 9 个路由；`netdisk.ts` 删除依赖 VideoResource 的 /share 与 /download；`chapter-taxonomy-service` 计数改为 netdiskAssets；`DEFAULT_REDIRECT_URI` 走 `PUBLIC_BASE_URL`；`tsc --noEmit` 与 `npm run build` 均通过，`/health` 200。
- **3.1-3.2** 删除 54 个前端文件（18 页面 + 6 组件 + 14 API 客户端）。
- **3.3-3.4** `Sidebar` 重写（admin 3 组 6 项、student 3 项、移除 SubjectSwitcher）；`App.tsx` 仅保留 11 条路由 + 全部旧路径重定向。
- **3.5-3.7** `learning-api` 重写；`ChapterMap` 改为「学科 Tab → 视频主线 → 关联小节」并用 `learningSubjectId` 记忆；`ChapterDetail` 删除本节试卷/错题，仅保留精选 + 更多资源。
- **3.8** `Workbench` 按角色重做（学生：继续学习/我的学科/最近打开；管理员：册章节统计/资源索引/快捷入口）。
- **3.9** `vite build` 242ms 通过，index 256KB。
- **4.1-4.7** 实测：`/api/learning/subjects` 返回 11 学科（math 73 / physics 124 / chemistry 60 / biology 81，其余 0）；旧端点 404；学生 `/learning` 11 Tab（4 可点 + 7 待建设灰显）、切物理后加载黄夫人系列与 19 节；`/learning/section/75` 5 条资源无试卷/错题块；学生工作台三区块；管理员 `/`、`/chapters`、`/netdisk-index`、`/resources` 均正常，0 console error；`/paper-library` 重定向到 `/learning`。

## 5. 云端部署

- [x] 5.1 云端备份 `/www/highschool-system/data/db/dev.db` 到 `backups/`
- [x] 5.2 同步代码（backend/src、backend/prisma、frontend、Dockerfile、deploy、docker-compose.yml、docs）
- [x] 5.3 `.env` 增加 `PUBLIC_BASE_URL=http://106.15.136.254`；`docker-compose.yml` 透传给 api
- [x] 5.4 上传新 `dev.db`（含删表结果）覆盖 data/db
- [x] 5.5 `docker compose build api web && docker compose up -d`，api healthy、web 80
- [x] 5.6 公网验证：`/` 200、登录、`/api/learning/subjects`、`/api/learning/video-series?subjectId=2`、视频流 206、旧端点 404
- [x] 5.7 更新 DB `NetdiskConfig.redirectUri` 为公网回调，并告知用户在百度开放平台登记

## 6. 文档与收尾

- [x] 6.1 `docs/deployment-docker.md` 增加「本次变更：能力收敛」与 PUBLIC_BASE_URL 说明
- [x] 6.2 删除 `openspec/specs/` 下 16 个退役 capability 目录，`openspec validate --all` 通过
- [x] 6.3 tasks 全部勾选，归档变更
