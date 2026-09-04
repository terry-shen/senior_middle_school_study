/**
 * Prompt Template Service
 * Handles loading, injection, and rendering of prompt templates
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export interface TemplateVariables {
  question?: string;
  standard_answer?: string;
  student_answer?: string;
  knowledge_points?: string;
  total_score?: string;
  history?: string;
  [key: string]: string | undefined;
}

export class PromptTemplateService {
  /**
   * Get active template for a task type
   */
  async getActiveTemplate(taskType: string): Promise<{
    id: number;
    name: string;
    template: string;
    taskType: string;
    version: number;
  } | null> {
    const template = await prisma.promptTemplate.findFirst({
      where: {
        taskType,
        isActive: true,
      },
      orderBy: {
        version: 'desc',
      },
    });

    return template;
  }

  /**
   * Render template with variable injection
   */
  renderTemplate(template: string, variables: TemplateVariables): string {
    let rendered = template;

    // Replace all {{variable}} placeholders
    for (const [key, value] of Object.entries(variables)) {
      if (value !== undefined) {
        const placeholder = `{{${key}}}`;
        rendered = rendered.replace(new RegExp(placeholder, 'g'), value);
      }
    }

    return rendered;
  }

  /**
   * Get rendered prompt for a task type
   */
  async getRenderedPrompt(
    taskType: string,
    variables: TemplateVariables
  ): Promise<string | null> {
    const template = await this.getActiveTemplate(taskType);
    if (!template) {
      return null;
    }

    return this.renderTemplate(template.template, variables);
  }

  /**
   * Inject knowledge points context
   */
  formatKnowledgePoints(knowledgePoints: Array<{
    name: string;
    description?: string;
    parent?: string;
  }>): string {
    if (!knowledgePoints || knowledgePoints.length === 0) {
      return '未提供知识点体系';
    }

    const formatted = knowledgePoints.map((kp, index) => {
      let line = `${index + 1}. ${kp.name}`;
      if (kp.description) {
        line += ` - ${kp.description}`;
      }
      if (kp.parent) {
        line += ` (上级: ${kp.parent})`;
      }
      return line;
    }).join('\n');

    return formatted;
  }

  /**
   * Format question content with metadata
   */
  formatQuestionContent(question: {
    content: string;
    type?: string;
    options?: string[];
    images?: string[];
  }): string {
    let formatted = `题目类型: ${question.type || '未知'}\n`;
    formatted += `题目内容: ${question.content}\n`;

    if (question.options && question.options.length > 0) {
      formatted += `选项:\n`;
      question.options.forEach((opt, i) => {
        formatted += `  ${String.fromCharCode(65 + i)}. ${opt}\n`;
      });
    }

    if (question.images && question.images.length > 0) {
      formatted += `图片附件: ${question.images.length}张\n`;
    }

    return formatted;
  }

  /**
   * Format conversation history
   */
  formatHistory(history: Array<{
    role: 'user' | 'assistant';
    content: string;
  }>): string {
    if (!history || history.length === 0) {
      return '';
    }

    return history.map(h => `[${h.role}]: ${h.content}`).join('\n\n');
  }

  /**
   * Build complete prompt for LLM call
   */
  async buildPrompt(
    taskType: string,
    params: {
      question: any;
      standardAnswer?: string;
      studentAnswer?: string;
      knowledgePoints?: Array<{ name: string; description?: string; parent?: string }>;
      totalScore?: number;
      history?: Array<{ role: 'user' | 'assistant'; content: string }>;
    }
  ): Promise<string | null> {
    const variables: TemplateVariables = {
      question: this.formatQuestionContent(params.question),
      standard_answer: params.standardAnswer,
      student_answer: params.studentAnswer,
      knowledge_points: params.knowledgePoints
        ? this.formatKnowledgePoints(params.knowledgePoints)
        : undefined,
      total_score: params.totalScore?.toString(),
      history: params.history ? this.formatHistory(params.history) : undefined,
    };

    return this.getRenderedPrompt(taskType, variables);
  }
}

export default new PromptTemplateService();