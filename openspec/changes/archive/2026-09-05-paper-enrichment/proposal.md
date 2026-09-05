## Why

MinerU 解析扫描版试卷时会产生 OCR 噪声（错字、LaTeX 残缺、选项错位、编号错乱），当前导入链路直接以解析结果入库，导致题库包含大量残次题目，人工逐题校对工作量巨大。需要一个"忠实还原"的 AI 清洗环节：在不改变题目原意的前提下，由大模型将 OCR 噪声清理掉，并把改动以 diff 形式呈现给人工快速审核，从而把校对成本从"审全部"降到"审有改动的题目"。

## What Changes

- 新增题目清洗能力：对拆题后的每道题，调用已配置的大模型进行**忠实还原清洗**——仅修复 OCR 错字、LaTeX 规范化、选项错位、编号错乱等机械性噪声，**明确禁止**改写数字与公式内容、补算答案、生成解析或补全缺失题干
- 清洗以 `parsedMarkdown`/`editedMarkdown` 拆出的题目为基准（方案 B：以 MinerU 输出为原稿基准），不对照 PDF 原图
- 新增分批异步执行：每批 15-20 题一次 LLM 调用，输出结构化 JSON 数组（含 `changed`、`changes[]` 修改理由、`confidence`），避免逐题调用导致的耗时与成本问题
- 清洗结果**永不自动落库**：作为"提议"持久化，前端在拆分预览页以 diff 形式展示，人工逐题接受/驳回，仅在人工确认后随 `confirm-import` 写入 `Question` 记录
- `changed: false` 或 `confidence` 低于阈值的题目单独标识（低置信度标"需人工复核"）

## Capabilities

### New Capabilities

- `paper-question-enrichment`: 试卷题目 AI 忠实还原清洗能力——触发入口、分批异步执行、diff 审核与接受/驳回、提议持久化与确认入库

### Modified Capabilities

- `exam-paper-import`: `confirm-import` 环节 SHALL 支持在确认时采用经人工审核通过的 AI 清洗结果（替换原拆分文本），不作为导入的自动步骤

## Impact

- **后端**：新增 `enricher-service.ts`（分批调用 LLMService、JSON 解析、超时/重试）；新增清洗提议持久化表（`EnrichmentProposal`，含 questionNumber/originalText/cleanedText/changes/confidence/status）；`papers.ts` 新增 `POST /api/papers/:id/enrich` 端点；`confirm-import` 支持接收已批准的清洗结果；新增 `enrichment` 类型 prompt 模板（seed）
- **前端**：`SplitPreview.tsx` 增加"AI 清洗"触发按钮、清洗进度展示、逐题 diff 视图（原文 vs 清洗版）与接受/驳回控件
- **依赖**：复用现有 `LLMService`（默认模型 qwen3.5:9b）、`PromptTemplateService`；不引入新依赖
- **无 BREAKING 变更**：清洗为可选手动触发，现有导入/拆题/确认流程保持不变