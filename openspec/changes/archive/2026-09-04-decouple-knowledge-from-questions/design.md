## Context

系统已完成 20 个模块、163 个任务的实现并归档。知识点（KnowledgePoint）当前以 5 层树形结构存储，code/name/level/parentId 强结构化；试题通过 Question.knowledgePoints JSON 字段与知识点关联；6 个下游模块（掌握度、知识地图、推荐、学习路径、班级统计、AI 试题分析）依赖此关联。系统已投入实际使用，AI 自动关联不可靠（本地 Ollama 慢、云端配额耗尽），需简化为"题库+测验+错题本"核心形态。

现有可复用资产：PaperEdit 双栏编辑器（textarea + MathLive 公式插入 + MathText 实时预览）、MathText 组件（KaTeX + 图片渲染）、mammoth Word 解析库（已安装）、MinerU CLI（PDF/DOCX 解析）、question-splitting-service（【答案】/【解析】标记提取）。

## Goals / Non-Goals

**Goals:**
- 知识点降级为独立参考文档，教师可上传 Word 文档并在线编辑
- 试题与知识点彻底解耦，删除 knowledgePoints 字段
- 移除 6 个依赖 KP 关联的下游模块（前端页面+后端服务+路由）
- 保留不依赖 KP 的模块（难度评估、在线测验、AI批改、错题本、模拟考试、学习激励）
- 复用现有 PaperEdit 编辑器和 MathText 组件，最小化新代码

**Non-Goals:**
- 不删除数据库表（保留 9 个下游表避免破坏性删表风险，仅停止写入和展示）
- 不删除 KnowledgePoint 表的旧字段（code/name/level/parentId 保留但停止使用，新增 contentMarkdown）
- 不重新设计学生端掌握度评估方案（待系统稳定运行后另行规划）
- 不修改 mineru-embedded-workflow 和 tag-based-question-splitting 的导入流程（已有富文本编辑校准）

## Decisions

### Decision 1: 复用 KnowledgePoint 表，新增 contentMarkdown 字段

**选择**: 在现有 KnowledgePoint 表上新增 `contentMarkdown String?` 字段，废弃 code/name/level/parentId/masteryLevel/suggestedHours/description 字段（保留但不使用）。

**替代方案**: 新建 KPDocument 表，迁移数据。
**否决理由**: KnowledgePoint 表已有数据（excel-knowledge-import 导入的 5 个 KP），新建表需迁移；复用表只需 db push 添加字段，零迁移成本。旧字段保留不影响功能，后续清理可单独进行。

**影响**: 
- schema.prisma: KnowledgePoint 模型新增 `contentMarkdown String?` 字段
- title 信息复用现有 `name` 字段（文档标题）
- 旧字段 code/name/level/parentId/masteryLevel/suggestedHours/description 保留但停止使用

### Decision 2: Word 文档导入使用 mammoth 转 Markdown，复用 PaperEdit 编辑器

**选择**: 上传 .docx/.doc → mammoth.extractRawText() 转 Markdown → 进入 PaperEdit 双栏编辑器校准 → 保存到 contentMarkdown 字段。

**替代方案 A**: 浏览器原生渲染 .docx（OnlyOffice/Collabora 自托管）。
**否决理由**: 需要起 Docker 容器或 WSGI 服务，基础设施成本高；.docx 是 ZIP+OOXML，浏览器原生不支持。

**替代方案 B**: 自研富文本编辑器（contentEditable WYSIWYG）。
**否决理由**: PaperEdit 双栏编辑器（textarea + MathLive + MathText 预览）已验证可用，复用零成本。

**影响**:
- 后端 knowledge-points.ts 路由: 新增 POST /import（multer 上传 .docx + mammoth 转 Markdown）
- 前端: KnowledgePointImport.tsx 重写为文件上传 + 跳转编辑器；KnowledgePointManagement.tsx 重写为文档列表
- 编辑器: 新建 KPEdit.tsx（复用 PaperEdit 逻辑，路由 /knowledge-points/:id/edit）
- 学生端: KnowledgePointBrowser.tsx（只读 MathText 渲染，或复用 KnowledgePointManagement 的只读模式）

### Decision 3: 删除 Question.knowledgePoints 字段（破坏性迁移）

**选择**: 直接从 Prisma schema 中删除 Question.knowledgePoints 字段，执行 `npx prisma db push` 同步。

**替代方案**: 保留字段但置空。
**否决理由**: 用户明确选择 D🅰️（删除字段）。保留无用字段会误导后续开发者，且数据库已有试题的 knowledgePoints 多为 null 或空 JSON。

**影响**:
- schema.prisma: Question 模型删除 `knowledgePoints String?` 字段
- db push 自动同步（SQLite 允许删列）
- 后端 papers.ts: GET /questions/all 移除 knowledgePoints 字段返回
- 前端 QuestionList.tsx: 移除知识点筛选下拉框
- 前端 papers-api.ts: Question 接口移除 knowledgePoints 字段

### Decision 4: 移除 6 个前端页面 + 4 个后端路由 + 5 个后端服务

**选择**: 直接删除文件 + 移除 index.ts 路由注册 + 移除 App.tsx 路由和导航。

**删除清单**:
- 前端页面: AnalysisManagement.tsx、KnowledgeMap.tsx、LearningPath.tsx、Recommendation.tsx、MasteryReport.tsx、ClassLearningStats.tsx（6 个）
- 前端 API 服务: analysis-api.ts、knowledge-map-api.ts、recommendation-api.ts、mastery-api.ts（4 个）
- 后端路由: analysis.ts、reviews.ts、mastery.ts、recommendation.ts（4 个）
- 后端服务: question-analysis-service.ts、review-service.ts、mastery-service.ts、recommendation-service.ts（4 个）

**保留**: difficulty-service.ts 和 difficulty.ts 路由（难度评估不依赖 KP，独立工作）；mock-exam-service.ts（保留按题筛选，移除按 KP 统计的逻辑）；incentive-service.ts（学习激励不依赖 KP）。

**影响**: 
- backend/src/index.ts: 移除 4 个 app.use 路由注册
- frontend/src/App.tsx: 移除 6 个 lazy import + 6 个 Route + 导航链接
- 删除文件后需重新编译验证

### Decision 5: 保留 9 个下游数据库表，仅停止写入

**选择**: MasteryRecord、MasteryHistory、LearningReport、LearningPath、LearningPathItem、RecommendationStrategy、Recommendation、RecommendationItem、RecommendationFeedback、PracticeSession 表保留在 schema.prisma 中，但不写入也不查询。

**替代方案**: 从 schema.prisma 删除表 + db push。
**否决理由**: SQLite 删表有数据丢失风险；保留表不影响功能（无人查询）；未来恢复 KP 关联时可复用表结构。

**影响**: schema.prisma 不修改这些表定义，Prisma Client 仍生成这些模型的类型（未使用但不报错）。

### Decision 6: 试卷导入流程移除自动 AI 分析触发

**选择**: papers.ts 的 POST /import 和 confirm-import 路由不再调用 question-analysis-service.analyzeQuestion()。试题的 answer/analysis 由 splitQuestionsFromMarkdown 从原文【答案】/【解析】标记提取。

**影响**:
- papers.ts: 移除 analyzeQuestion 调用（如有）
- splitQuestionsFromMarkdown: 已有答案/解析提取逻辑，无需修改
- 前端 PaperImport.tsx: 移除"AI分析中"状态提示
- 难度评估保持独立：管理员在 DifficultyManagement 页面手动触发

## Risks / Trade-offs

- **[风险] 删除 Question.knowledgePoints 字段导致已有数据丢失**
  - ⚠️ 缓解: 当前数据库中 Question.knowledgePoints 多为 null 或空 JSON（KP 关联功能从未真正工作），删除字段无实际数据损失
  - 备份: db push 前备份 dev.db

- **[风险] 删除 6 个前端页面 + 4 个后端服务后，代码引用未完全清理**
  - ⚠️ 缓解: 编译时 TypeScript 会报未定义引用错误，逐个修复；grep 搜索残留引用

- **[风险] 学生端失去"知识点掌握度"核心卖点**
  - ⚠️ 缓解: 用户已确认"等系统用起来后再考虑"，本次明确为 Non-Goal
  - 替代: 学生通过测验成绩、错题本、模拟考试对标分析了解学习状态

- **[权衡] 保留 9 个下游表增加 schema 复杂度**
  - ⚠️ 接受: 表定义保留但无人使用，不影响运行时性能；未来恢复 KP 关联时可复用

- **[权衡] Word 文档导入非"真 Word 编辑"**
  - ⚠️ 接受: mammoth 转 Markdown 会丢失部分复杂格式（如复杂表格、嵌入对象），但数学公式（如果 Word 中用公式编辑器）会转为文本表示。教师可在编辑器中校准。

## Migration Plan

1. **数据库**: schema.prisma 新增 KnowledgePoint.contentMarkdown 字段，删除 Question.knowledgePoints 字段，`npx prisma db push` 同步
2. **后端**: 删除 4 个服务 + 4 个路由文件，修改 index.ts 移除注册，修改 papers.ts 移除 AI 分析调用，修改 knowledge-points.ts 改为文档 CRUD + Word 导入
3. **前端**: 删除 6 个页面 + 4 个 API 服务，修改 App.tsx 移除路由和导航，重写 KnowledgePointImport/Management，新建 KPEdit
4. **编译验证**: backend npm run build + frontend npm run build
5. **重启服务**: 重启 backend，验证 health 200
6. **回滚策略**: 如出现问题，git revert 回到变更前 commit（所有文件变更在 git 跟踪中）
