## Why

当前系统将"知识点"与"试题"强耦合：试题通过 AI 自动识别知识点，下游 6 个模块（掌握度评估、知识地图、个性化推荐、学习路径、班级统计、AI 试题分析）依赖此关联。这导致：AI 自动关联不可靠（本地 Ollama 慢、云端配额耗尽）、系统复杂度高、教师无法直接复用已有 Word 教学大纲。系统已投入实际使用，需简化为"题库+测验+错题本"核心形态，知识点降级为独立参考文档，待系统稳定运行后再考虑恢复学生端掌握度评估。

## What Changes

- **BREAKING** 知识点导入改为 Word 文档（.docx）方式：上传后 mammoth 转 Markdown，浏览器内富文本编辑（复用 PaperEdit 双栏编辑器+MathLive 公式插入），不再使用 Excel 5层树模板
- **BREAKING** 知识点呈现改为文档浏览：学生端只读查看（MathText 渲染），管理员端在线编辑；废弃 code/name/level/parentId 树形结构字段，新增 contentMarkdown 字段
- **BREAKING** 试题与知识点彻底解耦：删除 Question.knowledgePoints 字段，删除 AI 试题分析全部功能（KP识别/解析生成/答案生成/摘要/元数据提取），删除 AnalysisManagement 前端页面
- **BREAKING** 移除 6 个下游模块的前端页面与后端服务：KnowledgeMap、LearningPath、Recommendation、MasteryReport、ClassLearningStats、AnalysisManagement
- **BREAKING** 移除 9 个数据表：MasteryRecord、MasteryHistory、LearningReport、LearningPath、LearningPathItem、RecommendationStrategy、Recommendation、RecommendationItem、RecommendationFeedback、PracticeSession
- 保留难度评估能力（difficulty-service 不变，DifficultyManagement 页面保留）
- 保留在线测验、AI批改、错题本、模拟考试、学习激励等不依赖 KP 的模块
- 错题本与题库管理中的"按知识点分类/筛选"requirement 移除，改为按题型/时间/难度分类
- 试卷导入流程移除"自动 AI 分析"步骤，导入后直接进入题库

## Capabilities

### New Capabilities

无新建 capability。所有变更均为对已有 capability 的修改。

### Modified Capabilities

- `knowledge-point-import`: 改为 Word 文档导入方式（.docx → mammoth → Markdown → 在线编辑），废弃 Excel 模板与 5 层树形结构
- `knowledge-point-management`: 改为文档浏览（学生只读）+ 在线富文本编辑（管理员），废弃树形 CRUD/code 生成/层级管理/前置依赖
- `question-analysis`: 移除全部 requirements（知识点自动识别、解析生成、答案生成、摘要生成、元数据提取、自动化分析流程）—— 此 capability 整体废弃
- `mastery-assessment`: 移除全部 requirements（掌握度计算、等级划分、趋势分析、薄弱识别、学习报告）—— 此 capability 整体废弃
- `knowledge-map-visualization`: 移除全部 requirements（树形图、地图视图、雷达图、详情面板、仪表盘）—— 此 capability 整体废弃
- `personalized-recommendation`: 移除全部 requirements（推荐算法、每日推荐、专项突破、学习路径规划、效果跟踪）—— 此 capability 整体废弃
- `wrong-question-collection`: 移除"按知识点分类"requirement，保留按题型/难度/时间分类
- `question-bank-management`: 移除"按知识点分类"requirement 与"知识点匹配验证"场景
- `exam-paper-import`: 移除"导入时自动AI分析"requirement，导入后不再触发 question-analysis

## Impact

**后端服务删除**：question-analysis-service、review-service、mastery-service、recommendation-service、mock-exam-service 中的 KP 关联逻辑（mock-exam 保留按题筛选，移除按 KP 统计）

**后端路由删除**：analysis、reviews、mastery、recommendation 路由整体移除

**前端页面删除**：AnalysisManagement、KnowledgeMap、LearningPath、Recommendation、MasteryReport、ClassLearningStats（6 个页面 + 路由 + 导航链接）

**前端页面改造**：KnowledgePointImport（改为 Word 上传+编辑）、KnowledgePointManagement（改为文档列表+浏览）、QuestionList（移除知识点筛选）、WrongQuestionBook（移除知识点分类）、PaperImport（移除导入后自动分析提示）

**数据库迁移**：Question.knowledgePoints 字段删除；KnowledgePoint 表新增 contentMarkdown 字段，旧 code/name/level/parentId 字段保留但停止使用；9 个下游表保留但停止写入（避免破坏性删表，后续清理）

**API 破坏性变更**：所有 /api/analysis、/api/reviews、/api/mastery、/api/recommendation 端点删除；/api/knowledge-points 树形 CRUD 端点改为文档 CRUD；/api/papers/:id/split 不再触发 AI 分析
