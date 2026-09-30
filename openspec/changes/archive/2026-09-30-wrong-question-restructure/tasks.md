# Tasks: 错题本重构（整卷模式下学生自主录入）

## 1. DB schema 重构

- [x] 1.1 schema.prisma: 删除 WrongQuestion、WrongQuestionPractice、VariationQuestion 三张模型
- [x] 1.2 schema.prisma: 新建 StudentWrongQuestion 模型（id/studentId/source/imageUrl?/content?/options?/myAnswer?/correctAnswer?/analysis?/questionType/difficulty/knowledgePointTags?/reviewStatus/wrongCount/createdAt/lastReviewAt，@@index([studentId, reviewStatus])）
- [x] 1.3 schema.prisma: Student 模型移除 wrongQuestions/wrongQuestionPractices 反向关系，加 studentWrongQuestions 反向关系
- [x] 1.4 npx prisma db push --accept-data-loss + prisma generate（先杀 node 后端解 DLL 锁）

## 2. 后端 service 重写

- [x] 2.1 重写 wrong-questions-service.ts: 移除 8 个旧函数；新建 createWrongQuestion(photo/manual)、getWrongQuestions(多维筛选+分页)、getWrongQuestionById、updateWrongQuestion(补录题面/编辑)、deleteWrongQuestion、practiceWrongQuestion(重练自评)、setMastered(标记/取消掌握)、getMasteryOverview(按标签分组掌握度)、printExport(返回排版数据供前端打印)
- [x] 2.2 mock-exam-service.ts: 移除 getWrongQuestionAnalysis 函数 + getMockExamResult 中对它的调用
- [x] 2.3 exam-service.ts: 移除 collectWrongQuestion 调用（如有，在 submitExam 链路中）

## 3. 后端 routes 重写

- [x] 3.1 重写 wrong-questions.ts: POST / (创建，multer 上传图片)、GET / (列表+筛选+分页)、GET /:id、PUT /:id (编辑/补录)、DELETE /:id、POST /:id/practice (重练自评)、PUT /:id/mastered (标记/取消掌握)、GET /mastery-overview (掌握度概览)、GET /print-export (打印排版数据)
- [x] 3.2 mock-exams.ts: 移除 /:id/wrong-analysis 路由（依赖已删除的 getWrongQuestionAnalysis）
- [x] 3.3 后端 npm run build 编译通过

## 4. 前端 API 服务重写

- [x] 4.1 重写 wrong-questions-api.ts: 移除旧类型与函数；新建 StudentWrongQuestion 类型 + createPhotoWrongQuestion/createManualWrongQuestion/getWrongQuestions/getWrongQuestionById/updateWrongQuestion/deleteWrongQuestion/practiceWrongQuestion/setMastered/getMasteryOverview/getPrintExportData 函数

## 5. 前端页面重写

- [x] 5.1 重写 WrongQuestionBook.tsx: 录入入口（拍照/手动两按钮）+ 掌握度概览（按标签分组+未分类行+薄弱高亮）+ 默认视图/全量视图切换 + 错题卡片列表（拍照题显示图片+补录入口，手动题 MathText 渲染）+ 多维筛选（题型/难度/标签/状态）+ 标记已掌握/取消掌握/编辑/删除按钮
- [x] 5.2 新建 WrongQuestionEdit.tsx: MathLive + textarea dual-pane 编辑器（复用 PaperEdit 模式）+ 元数据表单 + 选项编辑（选择题）+ 保存
- [x] 5.3 新建 WrongQuestionPractice.tsx: 重练弹窗（遮挡答案→作答→揭示→自评对错）
- [x] 5.4 新建 WrongQuestionPrint.tsx: 打印预览页面（选中错题排版 + 包含答案解析勾选 + window.print）
- [x] 5.5 WrongQuestionBook.css: 全部样式（录入入口卡片/掌握度概览条形图/错题卡片/重练弹窗/打印预览）

## 6. 前端集成

- [x] 6.1 App.tsx: 路由注册（/wrong-questions/edit/:id? /wrong-questions/practice/:id /wrong-questions/print）+ nav 链接保留（学生可见）
- [x] 6.2 MockExam.tsx: 移除错题分析视图（依赖已删除的 getWrongQuestionAnalysis）

## 7. 清理

- [x] 7.1 后端: 移除 export-service.ts 中错题导出相关函数（generateExamPDF/generateExamWord 对错题的调用，如存在）
- [x] 7.2 前端: 移除 mock-exams-api.ts 中 WrongQuestionAnalysis 类型 + getWrongQuestionAnalysis 函数（如存在）

## 8. 验证

- [x] 8.1 后端 npm run build 编译通过
- [x] 8.2 前端 npm run build 构建通过
- [x] 8.3 重启后端 + health 200
- [x] 8.4 E2E: 学生拍照录入→补录题面→手动录入→掌握度概览→重练自评→标记已掌握→默认视图消减→全量视图→打印预览
- [x] 8.5 回归: 模拟考试列表/试卷库/题库管理/在线测验功能不受影响
