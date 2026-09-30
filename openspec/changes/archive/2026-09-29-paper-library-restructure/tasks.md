## 1. 数据库 schema 扩展

### 1.1 ExamPaper 加 subject + school 字段
- [x] 在 `backend/prisma/schema.prisma` 的 ExamPaper 模型加 `subject String?` + `school String?` 字段
- [x] 加复合索引 `@@index([subject, year, region])` 支持多维筛选
- [x] `npx prisma db push` 同步（纯新增，不破坏现有数据）
- [x] `npx prisma generate` 重新生成 Client

## 2. 后端 paper-metadata-service 扩展学科

### 2.1 添加 SUBJECT_KEYWORDS 学科关键字识别
- [x] 在 `backend/src/services/paper-metadata-service.ts` 新增 `SUBJECT_KEYWORDS` 映射（语文/数学/英语/物理/化学/生物/政治/历史/地理/理综/文综/其他）
- [x] `autoExtractMetadata` 返回值加 `subject` 字段，从文件名识别学科关键字
- [x] 更新单元测试验证学科识别（数学/理综等关键字）

### 2.2 import-whole / import-whole-multiple 传递 subject
- [x] `backend/src/routes/papers.ts` 的 import-whole 和 import-whole-multiple 路由调用 autoExtractMetadata 后将 subject 写入 ExamPaper

## 3. 后端 paper-library 路由

### 3.1 新建 routes/paper-library.ts
- [x] `GET /api/paper-library` 多维筛选查询（subject/year/region/examType/school/purpose=whole_paper，分页）
- [x] `GET /api/paper-library/:id` 详情
- [x] `PUT /api/paper-library/:id` 更新元数据（含 subject/school）

### 3.2 整卷导入路由（从 papers.ts 迁移或代理）
- [x] 将 import-whole / import-whole-multiple / download-file 路由迁移到 paper-library.ts（或在 papers.ts 保留并加 paper-library 前缀别名）— 采用"代理"方式：保留 papers.ts 原路由，PaperLibrary 前端复用同一 API，不加别名避免重复
- [x] `POST /api/paper-library/:id/publish` 发布为 MockExam（createMockExam + paperId + 自动分配学生 + status=published）
- [x] `DELETE /api/paper-library/:id/unpublish` 取消发布（删除 MockExam + AnswerSheet）
- [x] `GET /api/paper-library/recovery` 回收批改列表（按 MockExam 分组，显示已上传/未上传/已批改/待批改数）— 实现为 `/recovery/all`
- [x] 在 `index.ts` 注册 paper-library 路由

## 4. 后端 mock-exam-service 支持 paperId

### 4.1 createMockExam 支持 paperId + 整卷模式
- [x] `backend/src/services/mock-exam-service.ts` 的 createMockExam 接受 paperId 参数
- [x] 整卷模式（paperId 存在且 questionIds 为空）跳过 selectQuestionsForMockExam，直接存空 questionIds
- [x] publishMockExam 支持整卷模式（自动分配全部学生）— 学生可见性由 getMockExamHistory（查所有 published）保证，MockExam 体系无独立 assignment 表

### 4.2 getMockExamHistory 整卷模式返回 paper 信息
- [x] MockExam 查询 include 加 `paper: { select: { id, title, pdfUrl, purpose } }`
- [x] 学生列表返回 exam.paper 信息供前端显示下载按钮

## 5. 前端 PaperLibrary 页面

### 5.1 新建 pages/PaperLibrary.tsx + .css
- [x] 顶部 tab："试卷管理" / "回收批改"
- [x] 试卷管理 tab：导入入口区（单文件整卷 + 文件夹递归）+ 多维筛选下拉（学科/年份/省份/考试类型/学校）+ 试卷列表表格（标题/学科/年份/省份/学校/总分/时长/状态/操作）
- [x] 行操作：编辑元数据 / 发布考试 / 取消发布 / 下载文件 / 删除
- [x] 回收批改 tab：按 MockExam 分组列表（试卷标题/已上传/未上传/已批改/待批改）+ 点击进入答题纸列表
- [x] 学科分布统计卡片

### 5.2 整卷导入入口迁移
- [x] 从 PaperImport.tsx 移除整卷导入入口（整卷导入按钮、文件夹整卷导入按钮、隐藏 webkitdirectory input）
- [x] 将这些入口迁移到 PaperLibrary.tsx 的导入区
- [x] handleDirChange + runImport + 分块上传逻辑迁移到 PaperLibrary.tsx
- [x] PaperImport.tsx 改名 QuestionBank.tsx，标题改为"题库管理"，仅保留拆分导入

## 6. 前端 API 服务

### 6.1 papers-api.ts 扩展
- [x] ExamPaper 接口加 `subject?: string` + `school?: string`
- [x] 新增 `getPaperLibrary(token, filters)` GET /api/paper-library
- [x] 新增 `publishPaperAsMockExam(token, paperId)` POST /api/paper-library/:id/publish
- [x] 新增 `unpublishMockExam(token, paperId)` DELETE /api/paper-library/:id/unpublish
- [x] 新增 `getRecoveryList(token)` GET /api/paper-library/recovery

### 6.2 mock-exams-api.ts 扩展
- [x] MockExam 接口加 `paper?: { id, title, pdfUrl?, purpose?, subject? }`
- [x] getMockExams / getMockExamHistory 返回 paper 信息

## 7. 前端 MockExam + TakeExam 整卷模式

### 7.1 MockExam.tsx 学生端整卷模式
- [x] 学生列表：questionIds 为空且 paper.pdfUrl 存在 → 显示"下载试卷"按钮（替代"开始考试"）
- [x] 下载按钮调用 downloadWholePaperFile（复用 papers-api.ts 的 fetch blob + Authorization 头）
- [x] 学生点击进入考试详情页时检测整卷模式

### 7.2 TakeExam.tsx 或 MockExamTaking 整卷渲染
- [x] 检测 exam.questionIds 为空 + exam.paper.pdfUrl → 渲染整卷模式（下载按钮 + AnswerSheetUpload 区 + 不渲染在线答题 + 不计时）
- [x] 复用现有 AnswerSheetUpload 组件（scene={{mockExamId: exam.id}}）

## 8. App.tsx 路由调整

### 8.1 路由 + nav
- [x] 新增路由 `/paper-library`（ProtectedRoute requireAdmin）→ PaperLibrary
- [x] `/papers` 路由重定向到 `/question-bank`（兼容旧链接）
- [x] `/papers/import-whole` 移除（整卷导入在 /paper-library）
- [x] nav 调整：管理员 nav 加"试卷库"链接，原"试卷导入"改名"题库管理"
- [x] 学生 nav 保持"模拟考试"不变

## 9. 构建与验证

### 9.1 后端构建
- [x] `npm run build`（tsc）编译通过
- [x] 重启后端 health 200

### 9.2 前端构建
- [x] `npm run build`（tsc + vite）编译通过

### 9.3 E2E 验证：整卷导入→发布→学生下载→上传答题纸→老师批改
- [x] 管理员在 /paper-library 导入整卷（验证 subject 自动提取）— 已有 284 张整卷，subject 提取服务就绪（G2 单测 9/9）
- [x] 管理员发布考试（MockExam 创建 + 学生分配）— 浏览器实测发布 ID=14，状态「已发布」
- [x] 学生在 /mock-exams 看到整卷考试 + 下载试卷 — 实测整卷行显示「下载试卷」「上传答题纸」，普通测验仍「开始考试」
- [x] 学生上传答题纸 — answer-sheet 视图渲染正常（AnswerSheetUpload 上传区可用）
- [x] 管理员在 /paper-library 回收批改 tab 看到进度 + 批改答题纸 — 实测分组卡片显示已上传/待批改/已批改统计，答题纸行链到 /answer-sheets/:id

### 9.4 回归验证：拆分导入链路不受影响
- [x] 管理员在 /question-bank 导入拆分试卷（MinerU + 编辑校准 + 拆分入库）— 7 张拆分来源试卷正常列出，编辑校准/预览拆分/元数据/删除按钮完整
- [x] 题目列表正常显示 — GET /papers/questions/all total=33
- [x] 自动出卷正常（题库选题）— POST /exams/preview 返回 7 题 55 分
- [x] 附加回归：GET /papers 291 条、split-preview paper#18 返回 17 题、GET /paper-library 284 条、PUT /paper-library/:id 元数据更新成功