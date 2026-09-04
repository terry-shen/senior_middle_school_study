## Context

题库管理已具备批量更新与批量导出，后端 `papers.ts` 已有 `POST /api/questions/batch/delete`（直接 `prisma.question.deleteMany`），但前端 `QuestionList.tsx` 无任何删除/勾选 UI，且无单题删除端点。Prisma schema 中 Question 的反向关系（StudentAnswer、AnswerRecord、WrongQuestion、VariationQuestion、AIContentReview、DifficultyAdjustment、MockExamAnswer）均已声明 `onDelete: Cascade`，因此 `deleteMany`/`delete` 会自动级联清理关联记录。但当前删除未校验题目是否被"进行中"测验引用，可能删掉学生正在作答的题目导致测验数据损坏。

## Goals / Non-Goals

**Goals:**
- 单题与批量删除在前端可达、可操作，带二次确认。
- 删除前阻断被"进行中"在线测验/模拟考试引用的题目，返回明确的阻断清单。
- 复用 Prisma 已有级联策略，避免手写关联清理逻辑。
- 保持批量删除接口入参 `{ ids }` 向后兼容。

**Non-Goals:**
- 不做软删除/回收站（物理删除）。
- 不做删除审计日志（后续可扩展）。
- 不重构现有 `deletePaper` 级联（试卷删除已正常工作）。
- 不引入权限细分（沿用 `requireAdmin`）。

## Decisions

### 决策1：复用 Prisma 级联，不手写关联清理
**选择**：直接用 `prisma.question.delete` / `deleteMany`，依赖 schema 中已声明的 `onDelete: Cascade` 自动清理 StudentAnswer/AnswerRecord/WrongQuestion/VariationQuestion/AIContentReview/DifficultyAdjustment/MockExamAnswer。
**理由**：schema 已统一声明级联，手写清理易遗漏且与 schema 重复。
**替代方案**：手动按顺序 `deleteMany` 每张关联表再删 Question——更冗长、易错，放弃。

### 决策2：删除前"进行中测验引用"阻断校验
**选择**：删除前查询 `AnswerRecord`（join `ExamRecord` status='in_progress'）与 `MockExamAnswer`（join `MockExam` status='in_progress'）是否引用待删题目；若有则整体阻断、返回阻断清单。
**理由**：避免删掉学生正在作答的题目导致测验无法提交或评分异常。
**替代方案**：允许删除并级联清理进行中测验的答题记录——会破坏学生正在进行的考试，风险过高，放弃。

### 决策3：单题删除端点 `DELETE /api/questions/:id`
**选择**：新增独立单题删除端点，复用同一阻断校验+级联。
**理由**：前端单题删除按钮直接调用，语义清晰；比复用 batch 端点更直观。
**替代方案**：前端单题删除也调 batch 接口传单元素数组——可行但语义模糊，放弃。

### 决策4：批量删除接口响应扩展 `blocked` 字段
**选择**：`POST /api/questions/batch/delete` 入参不变（`{ ids }`），响应在成功时增加 `deleted`，在阻断时返回 `{ blocked: [{questionId, reason, examNames[]}] }`（HTTP 409）。
**理由**：向后兼容入参，前端能区分"全删成功"与"部分阻断"。
**替代方案**：部分删除（删可删的、阻断的留下）——破坏原子性，用户难判断结果，放弃。

### 决策5：前端多选交互
**选择**：`QuestionList.tsx` 每题卡片左上加复选框，表头加全选复选框，选中数>0 时显示"批量删除(N)"按钮；每题卡片右下加单题删除按钮。删除前 `window.confirm` 显示受影响题数。
**理由**：最小改动复用现有卡片布局，符合管理后台习惯。
**替代方案**：独立批量操作工具栏页面——过度设计，放弃。

## Risks / Trade-offs

- [物理删除不可恢复] → 二次确认 + 阻断校验降低误删风险；后续如需回收站可单独立项。
- [大批量删除可能慢/锁库] → 单次批量删除设上限（如 500 题），超出提示分批；事务包裹避免部分删除。
- [阻断清单 examNames 需 join 查询] → 题量大时查询成本可控（仅对 in_progress 测验 join），可接受。
- [Prisma 级联依赖 schema 声明] → 已确认所有反向关系均 `onDelete: Cascade`，无需额外迁移；若后续新增关联表需同步声明级联。

## Migration Plan

1. 后端先发：新增 `DELETE /api/questions/:id`、改造 `POST /api/questions/batch/delete`（加阻断校验+`blocked` 响应）。纯增量，不影响现有调用方（入参不变，成功响应 `deleted` 字段已存在）。
2. 前端后发：`papers-api.ts` 加 2 函数，`QuestionList.tsx` 加 UI。前端旧版本对新接口无感知，兼容。
3. 回滚：后端回滚恢复原 `deleteMany`（无阻断）；前端回滚移除删除按钮。无数据库迁移，无需特殊回滚脚本。
