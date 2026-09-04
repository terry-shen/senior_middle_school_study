/**
 * Difficulty Service
 * Handles difficulty assessment and adjustment
 */

import { PrismaClient } from '@prisma/client';
import { LLMService } from './llm-service';
import { PromptTemplateService } from './prompt-template-service';

const prisma = new PrismaClient();
const llmService = new LLMService(prisma);
const promptTemplateService = new PromptTemplateService();

interface DifficultyResult {
  difficulty: 'easy' | 'medium' | 'hard' | 'very_hard';
  confidence: number;
  reasoning: string;
}

export class DifficultyService {
  /**
   * Assess difficulty for a single question
   */
  async assessDifficulty(questionId: number): Promise<DifficultyResult> {
    const question = await prisma.question.findUnique({
      where: { id: questionId }
    });

    if (!question) {
      throw new Error(`Question not found: ${questionId}`);
    }

    // Load difficulty assessment template
    const template = await promptTemplateService.getActiveTemplate('difficulty_assessment');
    
    const prompt = template
      ? template.template
          .replace('{{question}}', question.content)
      : `请评估以下数学题目的难度等级。

题目：
${question.content}

请根据以下标准评估难度：
- easy: 简单，基础知识点直接应用
- medium: 中等，需要一定分析和计算
- hard: 较难，需要综合多个知识点或复杂推理
- very_hard: 困难，需要创造性思维或特殊技巧

请以JSON格式返回：
{
  "difficulty": "easy|medium|hard|very_hard",
  "confidence": 0.0-1.0,
  "reasoning": "评估理由（50-100字）"
}`;

    const response = await llmService.generate({ prompt });

    try {
      const result = JSON.parse(response.content);
      return result as DifficultyResult;
    } catch (e) {
      const jsonMatch = response.content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]) as DifficultyResult;
      }
      throw new Error('Failed to parse difficulty assessment result');
    }
  }

  /**
   * Batch assess difficulty for multiple questions
   */
  async batchAssessDifficulty(questionIds: number[]): Promise<{
    success: number;
    failed: number;
    results: Array<{ id: number; difficulty?: string; error?: string }>;
  }> {
    const results: Array<{ id: number; difficulty?: string; error?: string }> = [];
    let success = 0;
    let failed = 0;

    for (const id of questionIds) {
      try {
        const result = await this.assessDifficulty(id);
        
        // Update question difficulty
        await prisma.question.update({
          where: { id },
          data: { difficulty: result.difficulty }
        });

        // Create adjustment history
        await prisma.difficultyAdjustment.create({
          data: {
            questionId: id,
            oldDifficulty: null,
            newDifficulty: result.difficulty,
            reason: `AI评估: ${result.reasoning}`,
            adjustedBy: null // AI adjustment
          }
        });

        results.push({ id, difficulty: result.difficulty });
        success++;
      } catch (e: any) {
        results.push({ id, error: e.message });
        failed++;
      }
    }

    return { success, failed, results };
  }

  /**
   * Manually adjust difficulty with history tracking
   */
  async adjustDifficulty(
    questionId: number,
    newDifficulty: 'easy' | 'medium' | 'hard' | 'very_hard',
    reason: string,
    adjustedBy: number
  ): Promise<void> {
    const question = await prisma.question.findUnique({
      where: { id: questionId }
    });

    if (!question) {
      throw new Error(`Question not found: ${questionId}`);
    }

    const oldDifficulty = question.difficulty;

    // Update question difficulty
    await prisma.question.update({
      where: { id: questionId },
      data: { difficulty: newDifficulty }
    });

    // Create adjustment history
    await prisma.difficultyAdjustment.create({
      data: {
        questionId,
        oldDifficulty,
        newDifficulty,
        reason,
        adjustedBy
      }
    });
  }

  /**
   * Get difficulty adjustment history for a question
   */
  async getAdjustmentHistory(questionId: number) {
    return prisma.difficultyAdjustment.findMany({
      where: { questionId },
      include: {
        adjuster: {
          select: { id: true, name: true, studentId: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  /**
   * Get difficulty statistics
   */
  async getDifficultyStats(filters?: {
    questionType?: string;
    knowledgePoint?: string;
  }) {
    const where: any = {};
    
    if (filters?.questionType) {
      where.questionType = filters.questionType;
    }

    const questions = await prisma.question.findMany({
      where,
      select: { difficulty: true }
    });

    const stats = {
      total: questions.length,
      easy: 0,
      medium: 0,
      hard: 0,
      very_hard: 0,
      unclassified: 0
    };

    for (const q of questions) {
      if (!q.difficulty) {
        stats.unclassified++;
      } else {
        stats[q.difficulty as keyof typeof stats]++;
      }
    }

    return stats;
  }
}