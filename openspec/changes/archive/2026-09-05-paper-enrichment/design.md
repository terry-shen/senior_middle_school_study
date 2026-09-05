## Context

现状链路：`导入(PDF) → MinerU → parsedMarkdown → [用户编辑] → editedMarkdown → split-preview → confirm-import → Question`。

- 拆题由 `question-splitting-service.ts` 完成（`splitQuestionsFromMarkdown` / `splitQuestionsByTags` / `splitQuestionsByTagsAndSave`），MinerU markdown 中已有 `<!--QN_START-->/<!--QN_END-->` 标签（导入时 `autoTagQuestions` 生成）或 `【答案】/【解析】` 标记。
- 拆分预览页 `SplitPreview.tsx` 已支持逐题查看 content/answer/analysis 并手动编辑，然后 `confirm-import` 落库。
- `LLMService` 提供统一调用（重试/回退/缓存），默认模型为 qwen3.5:9b（本地 Ollama）；`PromptTemplateService` 支持 `{{变量}}` 模板渲染，已有 7 种 taskType。
- 清洗方案已确认：以 MinerU 输出（`parsedMarkdown`/`editedMarkdown`）为基准做忠实还原，不做推断补全（见 proposal.md - Why / What Changes）。

## Goals / Non-Goals

**Goals:**
- 在 `split-preview` 与 `confirm-import` 之间插入可选的"AI 清洗"步骤，把人工审核范围从全部题目缩小到"有改动"的题目
- 清洗结果作为提议持久化，`changed:false` 的题不打扰人工
- 复用现有 LLMService / PromptTemplateService / SplitPreview 流程，不引入新依赖

**Non-Goals:**
- 不做任何智能补全（不改写数字/公式、不生成答案/解析、不补全缺失题干）
- 不做多模态对照（不对照 PDF 原图，纯文本清洗）
- 不做清洗任务的断点续跑/任务队列持久化（单次内存任务 + 状态查询即可）
- 不把清洗编入自动导入流程（保持 exam-paper-import 的"导入后直接入库"语义）

## Decisions

### D1: 清洗粒度 = 拆题后的逐题清洗（分批）

- **做法**：`split-preview` 拿到 `SplitQuestion[]` 后，按每批 15-20 题分组，每批一次 LLM 调用，prompt 内嵌多题 JSON 输入、要求返回 JSON 数组。
- **理由**：逐题调用 2000 题需要数小时；整卷一次调用超出上下文窗口且错误率剧增。15-20 题/批是质量/成本/延迟的平衡点（qwen3.5:9b 8K 上下文内）。
- **备选**：整卷清洗（上下文不够）、逐题清洗（太慢）——均否。

### D2: 清洗提议持久化到新增表 `EnrichmentProposal`

- **做法**：新增 Prisma 模型：
  ```
  EnrichmentProposal {
    id             Int      @id @default(autoincrement())
    paperId        Int      @map("paper_id")
    questionNumber Int      @map("question_number")
    originalText   String   @map("original_text")   // 清洗前文本（含 options/answer/analysis 原文）
    cleanedText    String   @map("cleaned_text")    // 清洗后文本
    changes        String   @map("changes")         // JSON 数组：修改理由列表
    confidence     Float    // 0-1
    status         String   @default("pending")     // pending / accepted / rejected
    createdAt/updatedAt
  }
  ```
- **理由**：清洗发生在题目落库之前（split-preview 阶段），`Question` 记录尚不存在，无法挂接到 Question/AIContentReview。独立表保证"提议不污染正式数据"——与忠实还原原则一致，`confirm-import` 只消费 `status=accepted` 的行。
- **备选**：暂存前端 state、confirm 时一次性提交——失败可恢复性差，刷新即丢，否。
- 注：`splitQuestionsByTagsAndSave` 已支持按 `paperId+questionNumber` 幂等更新，清洗结果用同一键匹配。

### D3: 清洗基准确认

- `split-preview` 的现有逻辑：`markdown = paper.editedMarkdown || paper.parsedMarkdown || paper.rawContent`。清洗直接用该 `SplitQuestion[]`，天然满足"优先人工编辑版"。
- 若某卷没有任何题目被拆出（`splitQuestionsByTags` 返回 0 题），清洗端点返回提示，不产生提议。

### D4: LLM 调用走 PromptTemplateService + LLMService

- 新增 seed 模板 `taskType: question_enrichment`（`backend/prisma/seeders/prompt-templates/question_enrichment.json`），模板硬编码约束（忠实还原、禁止改数字/公式/补全）+ `{{questions}}` 变量（批次内题目的 JSON）。
- 调用 `LLMService.chat`（批量文本更稳），解析返回 JSON 数组，`changes[]` 与原文逐条比对回填。
- 失败重试/模型回退复用 LLMService 内置机制；单批失败不中断整卷（记录该批失败，其余继续）。

### D5: 前端交互

- `SplitPreview.tsx` 顶部加"AI 清洗"按钮（加载/进度态）。
- 清洗完成后每题展示：
  - `changed:false` → 灰显"无需修改"，默认接受
  - `changed:true` → 并排 diff（原文 | 清洗后），`changes[]` 逐条列出，操作：接受 / 忽略（驳回），低置信度黄标"需复核"
- `confirm-import` 调用时携带 `acceptedProposals` 决策（或后端直接按 EnrichmentProposal.status 消费——后者更简单，前端只需维护状态标记，确认时后端读取 accepted 行）。

### D6: 新端点

- `POST /api/papers/:id/enrich`（requireAdmin）：触发清洗 → 立即返回任务 id / 或同步返回结果（分批耗时数分钟，采用轻量内存任务 + `GET /api/papers/:id/enrich/status` 轮询）。
- `confirm-import` 逻辑扩展：读取该卷 `EnrichmentProposal` 中 `accepted` 行，按 questionNumber 覆盖 `SplitQuestion.content/options` 后再落库。

## Risks / Trade-offs

- **[LLM 误改正确内容]** → 忠实还原约束写死在模板 + 强制要求 `changes[]` 逐条说明；人工必须扫一眼 diff 才能确认；单题可驳回保持原文。
- **[批量清洗耗时]** → 分批异步 + 进度轮询；用户可随时暂停放弃（未确认的提议不影响直接 confirm-import 原文档）。
- **[提议堆积]** → 确认导入后按 paperId 清理已消费的提议行，或提供"重跑清洗"覆盖。
- **[模型返回非 JSON/结构漂移]** → 解析失败该批标记失败并保留原文，不写脏提议；LLMService 重试机制兜底。
- **[选项/答案字段变化]** → 清洗只动 content/options 文本结构；answer/analysis 若来自【答案】【解析】标记则原样保留（忠实还原原则下 LLM 不得改动它们，proposal 中 separately 存原文兜底）。

## Migration Plan

- 新增 `EnrichmentProposal` 模型 → `prisma db push`（SQLite 无破坏性迁移）
- 新增 `question_enrichment` prompt 模板 seed（幂等 upsert）
- 后端不重启情况下需重新 `build` 并重启服务
- 回滚：功能为新增可选项，前端隐藏按钮 + 后端保留旧 confirm-import 逻辑即可安全回退

## Open Questions

- 后端是否需要 `GET /api/papers/:id/enrich/status` 轮询端点，还是前端单次长轮询/轮询该卷 proposals 数量即可？（实现时按简单原则定，不影响 spec）
- `confirm-import` 是否展示"本卷有 N 条已接受清洗"汇总（体验细节，不影响方案）