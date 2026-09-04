## 1. 后端：单题删除端点

- [x] 1.1 在 `backend/src/routes/papers.ts` 新增 `DELETE /api/questions/:id`（requireAdmin），先调用"进行中测验引用"阻断校验，通过后 `prisma.question.delete({ where: { id } })`（依赖 schema 级联清理关联），返回 `{ success: true }`；被阻断时返回 409 与引用测验清单。验证：curl 调用返回 200/409，关联表无孤儿记录。
- [x] 1.2 实现"进行中测验引用"校验辅助函数（查询 AnswerRecord join ExamRecord.status='in_progress'、MockExamAnswer join MockExam.status='in_progress'），返回 `{ blocked: boolean, examNames: string[] }`。验证：构造一条 in_progress 测验引用的题目，函数返回 blocked=true。

## 2. 后端：改造批量删除端点

- [x] 2.1 改造 `POST /api/questions/batch/delete`：删除前对每个 id 调用阻断校验，任一被阻断则整体返回 409 与 `{ blocked: [{questionId, examNames[]}] }`；全部通过则 `prisma.$transaction` 包裹 `deleteMany`，返回 `{ success: true, deleted: count }`。验证：批量删除无引用题目返回 deleted=N；含进行中测验引用题目返回 409 且不删任何题。
- [x] 2.2 单次批量删除设上限 500 题，超出返回 400 提示分批。验证：传 501 个 id 返回 400。

## 3. 前端：API 服务层

- [x] 3.1 在 `frontend/src/services/papers-api.ts` 新增 `deleteQuestion(token, id)` 调用 `DELETE /api/questions/:id`，返回 `{ success }` 或阻断错误。验证：函数存在且类型正确。
- [x] 3.2 新增 `batchDeleteQuestions(token, ids)` 调用 `POST /api/questions/batch/delete`，处理成功响应 `deleted` 与 409 阻断响应 `blocked`。验证：函数存在且能解析 409 响应。

## 4. 前端：QuestionList 多选与删除 UI

- [x] 4.1 在 `QuestionList.tsx` 题目卡片左上添加复选框，表头添加全选复选框，维护 `selectedIds: number[]` 状态。验证：勾选/全选/取消选中状态正确反映。
- [x] 4.2 选中数 > 0 时显示"批量删除(N)"按钮；每题卡片加单题"删除"按钮（仅管理员可见）。验证：按钮按选中数/权限显示。
- [x] 4.3 删除前 `window.confirm` 二次确认显示受影响题数；调用 API 后处理成功（刷新列表、清空选中）与阻断（alert 阻断清单）。验证：成功删除后列表刷新；阻断时 alert 显示被阻断题目与测验名。
- [x] 4.4 在 `QuestionList.css` 添加复选框、批量删除按钮样式，与现有卡片布局协调。验证：样式不破坏现有布局。

## 5. 集成验证

- [x] 5.1 后端 `npm run build` 编译通过；前端 `npm run build` 编译通过。验证：两个 build 均无错误。
- [x] 5.2 端到端：管理员登录 → 题目列表勾选多题 → 批量删除 → 列表刷新题目减少；单题删除 → 列表刷新。验证：题目数减少且无报错。
- [x] 5.3 阻断场景：构造一道被 in_progress 在线测验引用的题目，尝试单题/批量删除，验证返回阻断提示且题目仍在。
