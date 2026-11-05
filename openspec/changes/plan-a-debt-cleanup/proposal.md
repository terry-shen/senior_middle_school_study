# Proposal: plan-a-debt-cleanup (方案A债务清理)

## Why

系统经过 18 次架构调整后积累了三类债务（见《架构差异分析报告-2026-10-28.pptx》）：

1. **16 张死表**（0 代码写入方）：掌握度/推荐/学习路径/变式题/练习记录等表在 decouple-knowledge-from-questions 与 wrong-question-restructure 变更后失去全部读写方，但 schema 仍保留，且 Student/Question/KnowledgePoint 模型上挂着指向它们的反向关系。
2. **2 个幽灵 spec**：student-feedback（7 个 requirement，对应路由/页面已删）、geometry-enhancement（7 个 requirement，从未实现）——spec 声称存在但代码不存在。
3. **考试归属丢失**：publishExamSession 在未指定 studentIds/classIds 时静默分配全部学生 → 所有 published 考试对所有学生可见，无法按班级定向发布。

同时学习激励功能中依赖 masteryHistory 的部分（进步徽章、掌握度曲线、成就墙掌握度提升）因数据源已删而永远为空，属于死功能。

**产品定位收敛**（本变更确认）：高中学习系统 = 试卷全流程管理 + 离线批改系统。不再回补 AI 掌握度/推荐/知识地图闭环。

## What Changes

1. **删除 16 张死表**及其全部反向关系字段：MasteryRecord, MasteryHistory, LearningReport, RecommendationStrategy, Recommendation, RecommendationItem, RecommendationFeedback, PracticeSession, LearningPath, LearningPathItem, VariationQuestion, WrongQuestionPractice, AIContentReview, KnowledgePointRelation, StudentAnswer, TestConnection。清理 Student/Question/KnowledgePoint 上指向死表的反向关系；清理 knowledge-points-api.ts 中无人调用的 relation 函数。
2. **删除学习激励死功能**：mastery_improvement 徽章（progress_10/30/50，数据源已删永远无法颁发）、掌握度曲线接口（getMasteryProgressCurve）、成就墙掌握度提升块；前端移除对应展示。
3. **补回考试归属**：新建 ExamSessionAssignment 表；发布考试必须显式选择班级或学生（不再静默分配全部）；学生考试列表只返回被分配的考试；学生开始考试时校验分配；取消发布/删除考试级联清理分配记录；存量已发布考试迁移为分配给全部学生（保持可见性不回退）。
4. **删除 2 个幽灵 capability spec**：student-feedback、geometry-enhancement（整个 capability 移除）。

## Capabilities

### Removed Capabilities
- `student-feedback` — 路由/服务/页面已在 decouple 变更中删除，7 个 requirement 全部失效
- `geometry-enhancement` — 学生几何标注从未实现，7 个 requirement 无对应代码

### Modified Capabilities
- `learning-incentive` — 移除掌握度依赖：徽章类型去进步徽章、删除进步可视化 requirement、统计与激励场景去掌握度引用
- `mock-exam` — 发布考试须选择班级/学生（ExamSessionAssignment）；学生历史列表按分配过滤
- `exam-taking` — 在线测验统一为 ExamSession：发布须分配、学生列表仅见被分配考试、开始校验分配
- `paper-library` — 一键发布为模拟考试：发布时选择班级/学生，不再自动分配全部

## Impact

- **DB**：删 16 表 + 新增 exam_session_assignments 表；`prisma db push --accept-data-loss`（死表数据全部废弃）；存量 published/ongoing/graded 考试自动补分配记录
- **后端**：exam-session-service（publish/listForStudent/start/cancel/unpublish/delete）、incentive-service（删 4 处 masteryHistory 块 + 徽章种子清理）、schema 反向关系清理
- **前端**：新增考试分配选择弹窗（MockExam/OnlineExamManagement/PaperLibrary 三处发布入口）、LearningIncentive 移除掌握度曲线与进步徽章展示
- **风险**：发布操作从"零参数"变为"必须选择"，增加一步交互（弹窗默认列出全部班级复选框）；学生可见性收紧（存量考试已迁移分配，不回退）
