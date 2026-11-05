# Design: plan-a-debt-cleanup

## Context

系统经 18 次架构调整后，41 个 Prisma 模型中 16 张表已无任何读写方（掌握度/推荐/学习路径/变式题等在 decouple 与 wrong-question-restructure 后失活）；2 个 capability spec 无对应代码；publishExamSession 静默分配全部学生导致考试归属丢失。本变更为纯债务清理 + 归属补回，不新增产品能力。

## Goals / Non-Goals

**Goals**:
- schema 仅保留有真实读写方的模型
- spec 与代码一致（删除幽灵 capability）
- 考试发布显式分配，学生可见性按分配过滤
- 存量已发布考试可见性不回退（迁移补分配）

**Non-Goals**:
- 不回补 AI 掌握度/推荐/知识地图（方案 B/C 已否决）
- 不重构学习激励的剩余功能（打卡/排行/挑战不动）
- 不更新 README（20 模块旧文档另行处理）

## Decisions

### D1: 死表清单（16 张）与删除方式
MasteryRecord, MasteryHistory, LearningReport, RecommendationStrategy, Recommendation, RecommendationItem, RecommendationFeedback, PracticeSession, LearningPath, LearningPathItem, VariationQuestion, WrongQuestionPractice, AIContentReview, KnowledgePointRelation, StudentAnswer, TestConnection。

- 取证结论：MasteryHistory 有 4 处只读引用（incentive-service，无写入方，读永远空）；StudentAnswer 仅 prompt 模板参数名撞名（非表引用）；TestConnection 仅适配器方法名撞名；KnowledgePointRelation 仅前端 knowledge-points-api.ts 死函数引用（后端路由已删、前端无调用方）。
- 删除方式：`npx prisma db push --accept-data-loss`（死表数据全部废弃，无迁移价值）。
- 反向关系清理：Student（answers/reviews/masteryRecords/masteryHistory/learningReports/recommendations/feedbacks/practiceSessions/learningPaths）、Question（studentAnswers/reviews/recommendationItems）、KnowledgePoint（masteryRecords/masteryHistory/learningPathItems/relationsAsSource/relationsAsTarget）。
- 保留：Session（auth-service 写入、permission 读入）、DifficultyAdjustment、ExamTemplate、EnrichmentProposal、全部 incentive 表（Badge/UserBadge/CheckIn/Challenge 系列）、StudentWrongQuestion、AnswerSheet。

### D2: 考试归属 = 显式 ExamSessionAssignment 表
```prisma
model ExamSessionAssignment {
  id            Int      @id @default(autoincrement())
  examSessionId Int      @map("exam_session_id")
  studentId     Int      @map("student_id")
  classId       Int?     @map("class_id") // 分配来源班级（展开记录），可空
  createdAt     DateTime @default(now()) @map("created_at")
  examSession ExamSession @relation(fields: [examSessionId], references: [id], onDelete: Cascade)
  student     Student     @relation(fields: [studentId], references: [id], onDelete: Cascade)
  @@unique([examSessionId, studentId])
  @@index([studentId])
  @@map("exam_session_assignments")
}
```
- 备选方案（复用 pending ExamSubmission 作隐式分配）被否：整卷模式按 spec 不创建 ExamSubmission，语义冲突。
- publishExamSession 改为：studentIds 与 classIds 均空 → 抛错 400「请选择参考班级或学生」；classIds → 展开为学生（记录 classId 来源）；去重后 createMany 分配记录；online 模式仅为被分配学生 upsert pending ExamSubmission（保持现状语义）。
- listExamSessionsForStudent：include `assignments: { where: { studentId } }`，过滤 `assignments.length > 0`。
- startExamSession：校验分配存在，否则 403「未分配该考试」（admin 不受限）。
- cancel/unpublish/delete：级联删除分配（onDelete: Cascade + 手动清理双保险）。

### D3: 存量考试迁移（可见性不回退）
db push 后运行迁移脚本：对所有 status in (published, ongoing, graded) 的 ExamSession，为全部 role=student 学生补插 ExamSessionAssignment（幂等 upsert 跳过已存在）。当前 dev DB 仅 3 个 session（id 2 draft 不处理、3 published、4 published），迁移量极小。

### D4: 学习激励死功能摘除
- incentive-service.ts 删 4 处 masteryHistory 块：checkAllBadges 的 mastery_improvement 分支（badge 条件类型保留枚举但跳过）、getMasteryProgressCurve（改为返回空数组并停用路由或直接删函数+路由）、getAchievementWall 的 masteryImprovements（返回空数组）。
- 徽章种子：seedDefaultBadges 移除 progress_10/30/50（mastery_improvement）；DB 中已存在的 progress_* 徽章行删除（连带 UserBadge）。
- 前端 LearningIncentive.tsx：移除掌握度曲线 tab/请求与进步徽章分组展示（按 type==='progress' 过滤隐藏）。
- 保留：practice/streak/perfect/breakthrough 徽章（数据源均存活：ExamSubmission.answers、CheckIn、graded submission、StudentWrongQuestion.reviewStatus）。

### D5: 幽灵 spec 删除
- delta 以 REMOVED Requirements 全量标记（student-feedback 7 个、geometry-enhancement 7 个）。
- 归档同步时直接删除 openspec/specs/student-feedback/ 与 openspec/specs/geometry-enhancement/ 目录（capability 级移除），validate --all 预期 24→22 passed。

### D6: 前端发布分配 UI（3 入口共用一个弹窗）
- 新建 `components/ExamAssignDialog.tsx`：props { examId, title, onPublished }；加载班级列表（公开 GET /api/classes/list）渲染复选框（默认不勾选）+ 起止时间（可选）+「发布」按钮；提交 publishExamSession({ classIds, startTime, endTime })；400 错误（未选择）内联提示。
- MockExam.tsx：列表「发布」按钮改为打开弹窗。
- OnlineExamManagement.tsx：handlePublishExam 改为打开弹窗。
- PaperLibrary.tsx：现有发布模态框内嵌班级复选框（复用 ExamAssignDialog 的班级列表逻辑或直接在模态框中加复选框组），提交时带 classIds。
- 交互成本：单班级场景下勾选 1 个班级 + 点发布，共 2 次点击。

## Risks / Trade-offs

- **发布多一步交互**：从零参数变必选。缓解：弹窗默认聚焦班级区；dev 环境仅 1 个班级。
- **db push 数据丢失**：仅死表（已验证 0 写入方），MasteryHistory 旧数据随表删除（本来也无人再读）。
- **学生可见性收紧**：新发布的考试只有被分配者可见——这正是需求目的；存量考试已迁移不回退。
- **incentive 徽章枚举保留 mastery_improvement**：DB 可能残留该类型条件行，checkAllBadges 直接跳过不报错（防御式）。

## Migration Plan

1. 杀 node（DLL 锁）→ schema 编辑 → `npx prisma db push --accept-data-loss` → `npx prisma generate`
2. 运行 assignment 迁移脚本（存量 published/ongoing/graded → 全员分配）
3. 徽章清理脚本：删 progress_* Badge 行 + 关联 UserBadge
4. 后端代码改动 + build + 重启
5. 前端改动 + build
6. E2E：发布未选分配 400 → 选班级发布 → 学生 A（分配）可见/可开始 → 构造未分配学生 403
7. 归档时同步 spec（含删除 2 个幽灵 capability 目录）+ validate --all 22 passed
