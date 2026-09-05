## 1. 数据模型与种子数据

- [x] 1.1 在 `backend/prisma/schema.prisma` 新增 `EnrichmentProposal` 模型（paperId、questionNumber、originalText、cleanedText、changes JSON、confidence、status pending/accepted/rejected、时间戳），执行 `npx prisma generate` 验证类型生成成功
- [x] 1.2 新建 `backend/prisma/seeders/prompt-templates/question_enrichment.json`（taskType=question_enrichment），模板硬编码忠实还原约束（仅修 OCR 噪声/LaTeX 规范化/选项错位/编号错乱，禁止改数字与公式、禁止生成答案解析、要求输出 JSON 数组含 cleanedText/changed/changes/confidence），验证 JSON 合法且包含 `{{questions}}` 占位符
- [x] 1.3 执行 seed（或 upsert）使新模板入库（taskType=question_enrichment, isActive=true），用 Prisma 查询确认存在

## 2. 后端服务：enricher-service

- [x] 2.1 新建 `backend/src/services/enricher-service.ts`：导出 `enrichQuestions(paperId)` 与任务状态查询函数，从 paper 取 markdown（editedMarkdown || parsedMarkdown || rawContent）并用现有 `splitQuestionsByTags` 拆题，验证拆出 0 题时返回友好错误
- [x] 2.2 实现分批逻辑：题目按 15-20 题/批分组，每批用 `PromptTemplateService.getRenderedPrompt('question_enrichment', {questions})` 渲染 + `LLMService.chat` 调用，解析 JSON 数组并按 questionNumber 回填，验证单批 20 题以内能产出结构化结果
- [x] 2.3 实现单批失败容错：调 LLM 失败或 JSON 解析失败时记录该批失败原因、继续后续批次，最终结果标记失败题目，验证一批失败不影响其他批次
- [x] 2.4 实现 `EnrichmentProposal` 落库：跑批后将每题 originalText（原文）与 cleanedText 写入，changed=false 或解析失败的行写为 status=pending 且 cleanedText=原文（或跳过并记录），验证落库行数与拆题数一致
- [x] 2.5 从 `backend/src/services/mineru-service.ts` 与 question-splitting-service 确认 `SplitQuestion` 的 options/answer/analysis 字段能在 originalText 中完整保存（清洗兜底用），验证回填时字段不丢

## 3. 后端路由

- [x] 3.1 在 `backend/src/routes/papers.ts` 新增 `POST /api/papers/:id/enrich`（requireAdmin）：触发清洗任务同步执行并返回结果摘要（题数/变更数/失败数），验证 curl 调用返回 200 与摘要 JSON
- [x] 3.2 新增 `GET /api/papers/:id/enrich/status`（requireAdmin）：返回该卷 EnrichmentProposal 统计（总数/changed/已接受/已驳回/进行中状态），验证进度数据正确
- [x] 3.3 扩展 `POST /api/papers/:id/confirm-import`：落库前读取该卷 status=accepted 的 EnrichmentProposal，按 questionNumber 覆盖对应 SplitQuestion 的 content/options 后再执行 `splitQuestionsByTagsAndSave`，验证 accepted 行生效、rejected/pending 不计入
- [x] 3.4 confirm-import 完成后清理该卷已消费的 EnrichmentProposal（或标记 archived），验证重跑导入不产生重复提议

## 4. 前端

- [x] 4.1 `frontend/src/pages/SplitPreview.tsx` 增加"AI 清洗"按钮 + 进行中状态（禁用按钮、显示进度），调用 `POST /api/papers/:id/enrich` 后刷新数据，验证按钮触发与加载态
- [x] 4.2 拆题列表每题展示清洗结果：changed=false 灰显"无需修改"；changed=true 并排显示原文|清洗版 + changes[] 修改理由列表，验证 diff 视图渲染正确
- [x] 4.3 每题增加"接受/驳回"控件（低置信度黄色"需复核"），状态写入本地 state 并调用接口更新对应 EnrichmentProposal.status，验证状态切换与刷新后保持
- [x] 4.4 confirm-import 前展示"本卷 N 条已接受清洗"汇总提示，确认后跳转逻辑不变，验证提示出现且确认流程正常

## 5. 构建与验证

- [x] 5.1 后端 `npm run build` 通过，`lsp_diagnostics` 无错误
- [x] 5.2 前端 `npm run build`（或 tsc）通过
- [x] 5.3 端到端验证：对本地一份真实试卷（如已导入的《蔡德锦》卷）触发 enrich → 确认 → 题库出现清洗后题目，验证 rawContent 与 Question 记录内容一致、changed=false 题无噪声变更
- [x] 5.4 回归：不点该卷 enrich 直接 confirm-import 仍按原文入库（不破坏现有流程），验证行为与改动前一致