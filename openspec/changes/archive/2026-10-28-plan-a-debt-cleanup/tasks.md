# Tasks: plan-a-debt-cleanup

## 1. DB Schema 清理与分配表（G1）

- [x] 1.1 schema.prisma 删除 16 个死模型（MasteryRecord/MasteryHistory/LearningReport/RecommendationStrategy/Recommendation/RecommendationItem/RecommendationFeedback/PracticeSession/LearningPath/LearningPathItem/VariationQuestion/WrongQuestionPractice/AIContentReview/KnowledgePointRelation/StudentAnswer/TestConnection）
- [x] 1.2 清理反向关系字段：Student（answers/reviews/masteryRecords/masteryHistory/learningReports/recommendations/feedbacks/practiceSessions/learningPaths）、Question（studentAnswers/reviews/recommendationItems）、KnowledgePoint（masteryRecords/masteryHistory/learningPathItems/relationsAsSource/relationsAsTarget）
- [x] 1.3 新增 ExamSessionAssignment 模型（examSessionId/studentId/classId?/createdAt，@@unique([examSessionId,studentId])，@@index([studentId])，双 Cascade）+ ExamSession.assignments / Student.examSessionAssignments 反向关系
- [x] 1.4 杀 node 解锁 → `npx prisma db push --accept-data-loss` → `npx prisma generate` → 验证死表已删、新表存在
- [x] 1.5 迁移脚本 migrate-assignments.cjs：存量 published/ongoing/graded ExamSession 为全部 role=student 学生幂等补插 ExamSessionAssignment

## 2. 后端考试归属（G2）

- [x] 2.1 exam-session-service.ts publishExamSession：studentIds 与 classIds 均空 → 抛错「请选择参考班级或学生」；classIds 展开学生（记录来源 classId）；去重后创建分配记录；online 模式仅为被分配学生 upsert pending ExamSubmission
- [x] 2.2 exam-session-service.ts listExamSessionsForStudent：include assignments（where studentId）并过滤 assignments.length > 0
- [x] 2.3 exam-session-service.ts startExamSession：校验该学生存在分配（admin 豁免），否则抛 403「未分配该考试」
- [x] 2.4 exam-session-service.ts cancelExamSession / unpublishExamSession / deleteExamSession：级联清理 ExamSessionAssignment
- [x] 2.5 routes/exam-sessions.ts publish 路由确认透传 classIds/studentIds（现有 req.body ?? {} 已透传）；错误 statusCode 传递（400/403）

## 3. 后端死功能摘除（G3）

- [x] 3.1 incentive-service.ts 删除 4 处 masteryHistory 读块：checkAllBadges 的 mastery_improvement 分支、getMasteryProgressCurve（删函数）、getAchievementWall 的 masteryImprovements（改空数组）、其余 1 处
- [x] 3.2 incentive-service.ts seedDefaultBadges 移除 progress_10/30/50 定义；写清理脚本删 DB 中 progress_* Badge 行及关联 UserBadge（含已获得）
- [x] 3.3 knowledge-points-api.ts 删除死函数：KnowledgePointRelation 接口、createRelation、deleteRelation、getRelations（如有）
- [x] 3.4 后端 build（tsc）通过，0 死表引用残留（grep prisma.masteryHistory 等 16 表名 = 0）

## 4. 前端适配（G4）

- [x] 4.1 新建 components/ExamAssignDialog.tsx：班级复选框（GET /api/classes/list 公开接口）+ 可选起止时间 + 发布按钮 + 400 内联提示 + 已选班级计数
- [x] 4.2 MockExam.tsx：管理员列表「发布」按钮改为打开 ExamAssignDialog，onPublished 后刷新列表
- [x] 4.3 OnlineExamManagement.tsx：handlePublishExam 改为打开 ExamAssignDialog（复用）
- [x] 4.4 PaperLibrary.tsx：发布模态框内加班级复选框组，publishPaperAsMockExam 提交带 classIds；400 提示
- [x] 4.5 LearningIncentive.tsx：移除掌握度曲线 tab 与请求；徽章分组隐藏 type==='progress'；移除 masteryImprovements 成就墙展示（若有独立块）
- [x] 4.6 前端 build 通过（0 TS 错误）

## 5. 幽灵 spec 与验证（G5）

- [x] 5.1 openspec validate plan-a-debt-cleanup --type change 通过
- [x] 5.2 后端重启（精确 kill 命令）+ 三服务健康检查
- [x] 5.3 E2E：发布未选分配 400 → 选班级发布 200 → 分配学生可见/可开始 → 未分配学生 403；存量考试（id 3/4）学生仍可见（迁移生效）
- [x] 5.4 回归：jest 全量通过；浏览器 19 页回归（admin 14 + student 5）0 ErrorBoundary 0 console errors
- [x] 5.5 tasks.md 全部标记 + 最终报告（归档时执行 spec 同步：删 student-feedback / geometry-enhancement 主 spec 目录，validate --all 22 passed）
