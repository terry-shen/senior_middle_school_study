## Why

题库管理界面缺少删除题目的入口：管理员无法删除误录、重复或失效的试题，也无法批量清理某次导入产生的整批题目。当前后端已存在 `POST /api/questions/batch/delete`，但前端 `QuestionList` 没有任何勾选/删除 UI，也没有单题删除接口；批量删除后端直接 `deleteMany` 会留下孤儿关联记录（错题本、答案记录、变式题等），存在数据完整性风险。本次变更补齐单题与批量删除能力，并保证关联数据安全清理。

## What Changes

- 新增单题删除接口 `DELETE /api/questions/:id`（管理员），按外键级联策略清理关联数据。
- 改造现有批量删除接口 `POST /api/questions/batch/delete`：先校验题目未被"进行中"测验引用，再按级联顺序清理错题本、答案记录、变式题、AI审核记录等关联，最后删除题目本身。
- 前端 `papers-api.ts` 新增 `deleteQuestion(token, id)` 与 `batchDeleteQuestions(token, ids)` 函数。
- 前端 `QuestionList.tsx` 增加多选（复选框 + 全选）、批量删除按钮、单题删除按钮，带二次确认与受影响题数提示。
- 删除前阻断：若题目被未结束的在线测验/模拟考试引用，返回错误列表并阻止删除，引导用户先结束相关测验。

## Capabilities

### New Capabilities
<!-- 无新增能力，仅扩展现有题库管理能力 -->

### Modified Capabilities
- `question-bank-management`: 为"试题批量操作"需求补充单题删除与批量删除的行为定义，明确关联数据级联清理规则与"被进行中测验引用时阻断"的保护场景。

## Impact

- **后端**：`backend/src/routes/papers.ts` 新增 `DELETE /api/questions/:id`；改造 `POST /api/questions/batch/delete` 的删除逻辑（关联清理 + 引用校验）。涉及 Prisma 模型 Question 的关联：StudentAnswer、AnswerRecord、WrongQuestion、VariationQuestion、AIContentReview、DifficultyAdjustment、MockExamAnswer。
- **前端**：`frontend/src/services/papers-api.ts` 新增 2 个函数；`frontend/src/pages/QuestionList.tsx` 与 `QuestionList.css` 增加多选/删除 UI 与交互。
- **API**：新增 1 个端点，改造 1 个端点；不破坏现有接口契约（批量删除入参 `{ ids }` 保持不变，仅响应增加 `blocked` 字段）。
- **数据完整性**：删除操作改为事务化级联，避免孤儿关联记录。
