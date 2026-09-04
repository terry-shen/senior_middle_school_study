## 1. 数据库迁移

- [x] 1.1 在 schema.prisma 的 KnowledgePoint 模型新增 `contentMarkdown String?` 字段，删除 Question 模型的 `knowledgePoints String?` 字段，执行 `npx prisma db push` 同步数据库，验证 `npx prisma generate` 成功
- [x] 1.2 备份 dev.db 后验证 db push 不报错，确认 KnowledgePoint 表有 contentMarkdown 列、Question 表无 knowledge_points 列

## 2. 后端清理：删除依赖 KP 的服务与路由

- [x] 2.1 删除 backend/src/services/question-analysis-service.ts、review-service.ts、mastery-service.ts、recommendation-service.ts 四个文件，验证文件已删除
- [x] 2.2 删除 backend/src/routes/analysis.ts、reviews.ts、mastery.ts、recommendation.ts 四个文件，验证文件已删除
- [x] 2.3 修改 backend/src/index.ts 移除 4 个路由注册（analysis、reviews、mastery、recommendation 的 app.use 行），验证 `npm run build` 编译通过无未定义引用
- [x] 2.4 grep 搜索 backend/src 中残留的 question-analysis-service、review-service、mastery-service、recommendation-service import 引用，逐一清理，验证编译通过

## 3. 后端改造：知识点文档化

- [x] 3.1 重写 backend/src/routes/knowledge-points.ts：移除树形 CRUD/tree/ancestors/relations/import(Excel)/import/preview/import/confirm 端点，新增 GET / (文档列表)、GET /:id (文档详情)、POST / (新建文档)、PUT /:id (更新 contentMarkdown)、DELETE /:id (删除文档)、POST /import (multer 上传 .docx + mammoth 转 Markdown)，验证编译通过
- [x] 3.2 创建 backend/src/services/kp-document-service.ts 或在 knowledge-points.ts 内联实现 Word 导入逻辑：multer 上传 .docx → mammoth.extractRawText() 转 Markdown → 创建 KnowledgePoint 记录（name=文件名，contentMarkdown=转换结果），验证单个 .docx 文件上传后能创建记录
- [x] 3.3 修改 backend/src/routes/papers.ts：移除 POST /:id/split 和 confirm-import 中对 analyzeQuestion 的调用（如有），验证导入流程不再触发 AI 分析

## 4. 后端清理：试题相关 KP 引用

- [x] 4.1 修改 backend/src/routes/papers.ts：GET /questions/all 移除 knowledgePoints 字段返回（Prisma findMany select 移除 knowledgePoints），验证 API 返回的 Question 对象无 knowledgePoints 字段
- [x] 4.2 grep 搜索 backend/src 中残留的 `knowledgePoints` 或 `knowledge_points` 引用（排除 schema.prisma 的 KnowledgePoint 模型本身），逐一清理，验证编译通过
- [x] 4.3 修改 backend/src/services/mock-exam-service.ts：移除按知识点统计的逻辑（getWrongQuestionAnalysis 中的 byKnowledgePoint 分组），保留按题型统计，验证编译通过

## 5. 前端清理：删除依赖 KP 的页面与服务

- [x] 5.1 删除 frontend/src/pages/AnalysisManagement.tsx、KnowledgeMap.tsx、LearningPath.tsx、Recommendation.tsx、MasteryReport.tsx、ClassLearningStats.tsx 六个文件及对应 .css，验证文件已删除
- [x] 5.2 删除 frontend/src/services/analysis-api.ts、knowledge-map-api.ts、recommendation-api.ts、mastery-api.ts 四个文件，验证文件已删除
- [x] 5.3 修改 frontend/src/App.tsx：移除 6 个 lazy import + 6 个 Route + 6 个导航链接，验证 `npm run build` 编译通过无未定义引用
- [x] 5.4 grep 搜索 frontend/src 中残留的 AnalysisManagement、KnowledgeMap、LearningPath、Recommendation、MasteryReport、ClassLearningStats 引用，逐一清理，验证编译通过

## 6. 前端改造：知识点文档化

- [x] 6.1 重写 frontend/src/services/knowledge-point-import-api.ts：移除 Excel 相关函数（downloadTemplate、uploadExcelForPreview、confirmImport），新增 uploadWordDocument(token, file) → 返回 {paperId, title, contentMarkdown}，验证 TypeScript 类型定义正确
- [x] 6.2 重写 frontend/src/pages/KnowledgePointImport.tsx：改为 Word 文件上传页面（.docx/.doc 选择 + 上传按钮 + 上传后跳转 /knowledge-points/:id/edit），验证编译通过
- [x] 6.3 重写 frontend/src/pages/KnowledgePointManagement.tsx：改为文档列表页面（展示 id/title/updatedAt + 新建按钮 + 编辑按钮 + 删除按钮 + 学生只读浏览），验证编译通过
- [x] 6.4 新建 frontend/src/pages/KPEdit.tsx（复用 PaperEdit 双栏编辑器逻辑）：路由 /knowledge-points/:id/edit，加载 KnowledgePoint.contentMarkdown → 编辑 → 保存，验证编译通过
- [x] 6.5 修改 frontend/src/App.tsx：添加 /knowledge-points/:id/edit 路由，验证编译通过

## 7. 前端清理：试题与错题本移除 KP 引用

- [x] 7.1 修改 frontend/src/pages/QuestionList.tsx：移除知识点筛选下拉框和相关 state，验证编译通过
- [x] 7.2 修改 frontend/src/services/papers-api.ts：Question 接口移除 knowledgePoints 字段，验证编译通过
- [x] 7.3 修改 frontend/src/pages/WrongQuestionBook.tsx：移除"按知识点分类"视图和 stats 中的 byKnowledgePoint 显示，保留按题型/难度/时间分类，验证编译通过
- [x] 7.4 修改 frontend/src/services/wrong-questions-api.ts：WrongQuestionStats 类型移除 byKnowledgePoint 字段，验证编译通过

## 8. 构建与验证

- [x] 8.1 后端 `npm run build` 编译通过，无 TypeScript 错误
- [x] 8.2 前端 `npm run build` 编译通过，无 TypeScript 错误
- [x] 8.3 重启后端服务，验证 http://localhost:3000/health 返回 200
- [x] 8.4 验证 /api/analysis、/api/reviews、/api/mastery、/api/recommendation 端点已移除（返回 404）
- [x] 8.5 验证 /api/knowledge-points 返回文档列表（GET）、/api/knowledge-points/import 接受 .docx 上传（POST）
- [x] 8.6 验证 /api/papers/questions/all 返回的 Question 对象无 knowledgePoints 字段
- [x] 8.7 浏览器访问前端首页，验证导航中无"知识地图""学习路径""智能推荐""掌握度报告""班级统计""AI分析"6 个链接
- [x] 8.8 浏览器访问 /knowledge-points，验证文档列表页面正常显示
- [x] 8.9 浏览器访问 /knowledge-points/import，验证 Word 上传页面正常显示
- [x] 8.10 上传一个 .docx 文件，验证跳转到编辑器且左侧显示转换后的 Markdown、右侧 MathText 预览正常
