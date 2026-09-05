/**
 * Enricher Service
 * AI 忠实还原清洗：对拆分后的题目调用大模型清理 OCR 机械性噪声。
 * 清洗结果作为"提议"写入 EnrichmentProposal（pending），绝不自动落库。
 * 人工逐题接受/驳回，confirm-import 仅消费 status=accepted 的提议。
 */

import { PrismaClient } from '@prisma/client';
import { LLMService } from './llm-service';
import { PromptTemplateService } from './prompt-template-service';
import { splitQuestionsByTags, SplitQuestion } from './question-splitting-service';

const prisma = new PrismaClient();
const llmService = new LLMService(prisma);
const promptTemplateService = new PromptTemplateService();

const BATCH_SIZE = 15; // 每批题目数（一次 LLM 调用）
const LOW_CONFIDENCE_THRESHOLD = 0.7; // 低于该值的清洗结果前端标"需复核"

export interface EnrichmentSummary {
  total: number;
  changed: number;
  failed: number;
  unchanged: number;
}

export interface EnrichmentItem {
  questionNumber: number;
  cleanedText: string;
  changed: boolean;
  changes: string[];
  confidence: number;
}

/**
 * 构造传给 LLM 的题目文本（完整题面含选项，不含答案/解析——忠实还原不触碰它们）
 */
function serializeQuestion(q: SplitQuestion): string {
  let text = q.content;
  if (q.options && q.options.length > 0) {
    // 确保选项以可辨认行内落于题面：content 通常已含选项，若缺失则追加
    const optionTexts = q.options
      .map((opt, i) => `${String.fromCharCode(65 + i)}. ${opt}`)
      .join('\n');
    if (!/A[.、）)]/.test(text)) {
      text = `${text}\n${optionTexts}`;
    }
  }
  return text;
}

/**
 * 从 LLM 响应中解析 JSON 数组（容忍 markdown 代码块包裹与前后噪音）
 */
function parseJsonArray(text: string): any[] {
  const trimmed = (text || '').trim();
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fence ? fence[1].trim() : trimmed;
  const start = candidate.indexOf('[');
  const end = candidate.lastIndexOf(']');
  if (start >= 0 && end > start && end < candidate.length) {
    const parsed = JSON.parse(candidate.substring(start, end + 1));
    if (Array.isArray(parsed)) {
      return parsed;
    }
  }
  throw new Error('Failed to parse enrichment JSON array from LLM response');
}

/**
 * 落库（或更新）一条清洗提议；异常/无修改时以原文兜底保证行数与拆题数一致
 */
async function upsertProposal(
  paperId: number,
  question: SplitQuestion,
  item: EnrichmentItem | null,
  error?: string
): Promise<EnrichmentItem> {
  const originalText = question.content;
  const fallback: EnrichmentItem = {
    questionNumber: question.questionNumber,
    cleanedText: originalText,
    changed: false,
    changes: [],
    confidence: 0,
  };

  let effective = fallback;
  if (item) {
    // 只信任有内容且确实变更的提议；清洗结果与原文一致时视为未变更
    const cleaned = typeof item.cleanedText === 'string' && item.cleanedText.trim().length > 0
      ? item.cleanedText.trim()
      : originalText;
    const changed = Boolean(item.changed) && cleaned !== originalText;
    const changes = Array.isArray(item.changes)
      ? item.changes.map((c: any) => String(c)).filter(Boolean)
      : [];
    const confidence = typeof item.confidence === 'number'
      ? Math.min(1, Math.max(0, item.confidence))
      : 0;
    effective = {
      questionNumber: item.questionNumber,
      cleanedText: cleaned,
      changed,
      changes,
      confidence,
    };
  }
  // error 时仍是 fallback（原文），但保持 changed=false 记录

  const changesForDb = error
    ? JSON.stringify([`清洗失败，保留原文: ${error}`])
    : JSON.stringify(effective.changes);

  await prisma.enrichmentProposal.upsert({
    where: {
      paperId_questionNumber: { paperId, questionNumber: question.questionNumber },
    },
    update: {
      cleanedText: effective.cleanedText,
      changes: changesForDb,
      confidence: effective.confidence,
      status: 'pending',
    },
    create: {
      paperId,
      questionNumber: question.questionNumber,
      originalText,
      cleanedText: effective.cleanedText,
      changes: changesForDb,
      confidence: effective.confidence,
      status: 'pending',
    },
  });

  return effective;
}

/**
 * 处理一批题目：渲染模板 -> 调 LLM -> 解析 -> 逐题落库。
 * 单批失败抛出，由调用方容错处理（不中断其余批次）。
 */
async function processBatch(paperId: number, batch: SplitQuestion[]): Promise<{ changed: number }> {
  const inputs = batch.map(q => ({
    questionNumber: q.questionNumber,
    text: serializeQuestion(q),
  }));

  const prompt = await promptTemplateService.getRenderedPrompt('question_enrichment', {
    questions: JSON.stringify(inputs, null, 2),
  });
  if (!prompt) {
    throw new Error('question_enrichment prompt template not found or inactive');
  }

  const response = await llmService.generate({ prompt, temperature: 0.1, maxTokens: 4096 });
  const parsed = parseJsonArray(response.content);

  // 按 questionNumber 索引 LLM 返回
  const byNumber = new Map<number, EnrichmentItem>();
  for (const item of parsed) {
    if (item && typeof item.questionNumber === 'number') {
      byNumber.set(item.questionNumber, item as EnrichmentItem);
    }
  }

  let changed = 0;
  for (const q of batch) {
    const item = byNumber.get(q.questionNumber);
    const result = await upsertProposal(paperId, q, item || null);
    if (result.changed) changed++;
  }
  return { changed };
}

/**
 * 对试卷执行全文忠实还原清洗（同步执行，返回摘要）。
 * - 以 editedMarkdown || parsedMarkdown || rawContent 为基准拆题
 * - 分批（BATCH_SIZE 题/批）调用 LLM
 * - 单批失败容错：记录失败、继续后续批次
 * - 结果落库 EnrichmentProposal(status=pending)，不改动任何 Question
 */
export async function enrichPaper(paperId: number): Promise<EnrichmentSummary> {
  const paper = await prisma.examPaper.findUnique({ where: { id: paperId } });
  if (!paper) {
    throw new Error('Paper not found');
  }

  const markdown = paper.editedMarkdown || paper.parsedMarkdown || paper.rawContent;
  if (!markdown || markdown.length < 10) {
    throw new Error('No markdown content to split');
  }

  const splitResult = splitQuestionsByTags(markdown);
  if (!splitResult.success || splitResult.questions.length === 0) {
    throw new Error('未找到可清洗的题目，请先在拆分预览确认拆题结果');
  }

  const questions = splitResult.questions;
  let changed = 0;
  let failed = 0;

  for (let i = 0; i < questions.length; i += BATCH_SIZE) {
    const batch = questions.slice(i, i + BATCH_SIZE);
    try {
      const result = await processBatch(paperId, batch);
      changed += result.changed;
      console.log(`[enricher] Paper ${paperId} batch ${i / BATCH_SIZE + 1} done (${batch.length} questions)`);
    } catch (error: any) {
      failed += batch.length;
      console.error(`[enricher] Paper ${paperId} batch failed (${batch.length} questions): ${error.message}`);
      // 失败批落库为原文兜底，保证前端可见题量一致且可重跑
      for (const q of batch) {
        await upsertProposal(paperId, q, null, error.message);
      }
    }
  }

  return {
    total: questions.length,
    changed,
    failed,
    unchanged: questions.length - changed - failed,
  };
}

/**
 * 查询试卷清洗状态统计（前端进度轮询/加载用）
 */
export async function getEnrichmentStatus(paperId: number): Promise<{
  total: number;
  changed: number;
  accepted: number;
  rejected: number;
  pending: number;
  needsReview: number;
  proposals: Array<{
    questionNumber: number;
    originalText: string;
    cleanedText: string;
    changes: string[];
    confidence: number;
    status: string;
  }>;
}> {
  const records = await prisma.enrichmentProposal.findMany({
    where: { paperId },
    orderBy: { questionNumber: 'asc' },
  });

  const proposals = records.map(r => ({
    questionNumber: r.questionNumber,
    originalText: r.originalText,
    cleanedText: r.cleanedText,
    changes: safeParseChanges(r.changes),
    confidence: r.confidence,
    status: r.status,
  }));

  return {
    total: proposals.length,
    changed: proposals.filter(p => p.changes.length > 0).length,
    accepted: proposals.filter(p => p.status === 'accepted').length,
    rejected: proposals.filter(p => p.status === 'rejected').length,
    pending: proposals.filter(p => p.status === 'pending').length,
    needsReview: proposals.filter(p => p.confidence > 0 && p.confidence < LOW_CONFIDENCE_THRESHOLD).length,
    proposals,
  };
}

/**
 * 更新单题提议状态（人工接受/驳回）
 */
export async function setProposalStatus(
  paperId: number,
  questionNumber: number,
  status: 'accepted' | 'rejected'
): Promise<void> {
  await prisma.enrichmentProposal.updateMany({
    where: { paperId, questionNumber },
    data: { status },
  });
}

/**
 * 读取某卷已接受的清洗提议列表（confirm-import 消费）
 */
export async function getAcceptedProposals(paperId: number): Promise<Array<{
  questionNumber: number;
  cleanedText: string;
}>> {
  const proposals = await prisma.enrichmentProposal.findMany({
    where: { paperId, status: 'accepted' },
  });
  return proposals.map(p => ({ questionNumber: p.questionNumber, cleanedText: p.cleanedText }));
}

/**
 * 确认导入完成后清理该卷全部提议（已消费，避免下次导入重复）
 */
export async function clearProposals(paperId: number): Promise<void> {
  await prisma.enrichmentProposal.deleteMany({ where: { paperId } });
}

function safeParseChanges(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}