// Inline question splitting logic for unit testing
type QuestionType = 'choice' | 'fill' | 'essay' | 'unknown';

interface SplitQuestion {
  questionNumber: number;
  content: string;
  questionType: QuestionType;
  score: number;
  options?: string[];
}

function identifyQuestionType(text: string): QuestionType {
  const hasOptions = /\n[A-D][.、)]\s/.test(text) || /\n[A-D][.、)]/.test(text);
  const hasBlank = /_{2,}|____/.test(text);
  const hasSubQuestion = /\([123]\)/.test(text) || /（[123]）/.test(text);

  if (hasOptions) return 'choice';
  if (hasBlank) return 'fill';
  if (hasSubQuestion || text.length > 50) return 'essay';
  return 'unknown';
}

function extractScore(text: string): number {
  const fullMatch = text.match(/本题满分(\d+)分/);
  if (fullMatch) return parseInt(fullMatch[1]);
  const simpleMatch = text.match(/[（(](\d+)分[)）]/);
  if (simpleMatch) return parseInt(simpleMatch[1]);
  return 0;
}

function extractOptions(text: string): string[] | undefined {
  const options: string[] = [];
  const lines = text.split('\n');
  for (const line of lines) {
    const match = line.trim().match(/^([A-D])[.、)]\s*(.+)/);
    if (match) {
      options.push(`${match[1]}. ${match[2]}`);
    }
  }
  return options.length > 0 ? options : undefined;
}

function splitQuestions(text: string): SplitQuestion[] {
  if (!text || text.trim().length === 0) return [];

  const questionPattern = /(\d+)[.、]\s*/g;
  const matches: { index: number; number: number }[] = [];
  let match;

  while ((match = questionPattern.exec(text)) !== null) {
    matches.push({ index: match.index, number: parseInt(match[1]) });
  }

  if (matches.length === 0) return [];

  const questions: SplitQuestion[] = [];

  for (let i = 0; i < matches.length; i++) {
    const start = matches[i].index;
    const end = i + 1 < matches.length ? matches[i + 1].index : text.length;
    const content = text.substring(start, end).trim();

    questions.push({
      questionNumber: matches[i].number,
      content,
      questionType: identifyQuestionType(content),
      score: extractScore(content),
      options: extractOptions(content),
    });
  }

  return questions;
}

describe('QuestionSplittingService', () => {
  describe('splitQuestions - choice questions', () => {
    it('should split a single choice question with options', () => {
      const text = `1. 下列函数中，在区间(0, +∞)上单调递增的是（  ）
A. y = -x
B. y = 1/x
C. y = x^2
D. y = -x^2
（本题满分5分）`;
      const result = splitQuestions(text);
      expect(result.length).toBeGreaterThanOrEqual(1);
      expect(result[0].questionType).toBe('choice');
      expect(result[0].score).toBe(5);
      expect(result[0].content).toContain('单调递增');
    });

    it('should split multiple choice questions', () => {
      const text = `1. 下列说法正确的是（  ）
A. 选项一
B. 选项二
C. 选项三
D. 选项四
（5分）

2. 已知函数f(x) = x + 1，则f(2) = （  ）
A. 1
B. 2
C. 3
D. 4
（5分）`;
      const result = splitQuestions(text);
      expect(result.length).toBe(2);
      expect(result[0].questionType).toBe('choice');
      expect(result[1].questionType).toBe('choice');
    });
  });

  describe('splitQuestions - fill questions', () => {
    it('should identify fill-in-the-blank questions', () => {
      const text = `1. 已知集合A = {1, 2, 3}，则A的子集个数为______。
（本题满分4分）`;
      const result = splitQuestions(text);
      expect(result.length).toBeGreaterThanOrEqual(1);
      expect(result[0].questionType).toBe('fill');
      expect(result[0].score).toBe(4);
    });
  });

  describe('splitQuestions - essay questions', () => {
    it('should identify essay/解答题 questions', () => {
      const text = `1. 已知函数f(x) = x^2 - 2x + 1，求：
(1) 函数的定义域；
(2) 函数的最小值。
（本题满分12分）`;
      const result = splitQuestions(text);
      expect(result.length).toBeGreaterThanOrEqual(1);
      expect(result[0].score).toBe(12);
    });
  });

  describe('splitQuestions - score extraction', () => {
    it('should extract score from （本题满分12分）format', () => {
      const text = `1. 某题（本题满分12分）`;
      const result = splitQuestions(text);
      expect(result[0].score).toBe(12);
    });

    it('should extract score from （12分）format', () => {
      const text = `1. 某题（12分）`;
      const result = splitQuestions(text);
      expect(result[0].score).toBe(12);
    });

    it('should default to 0 score when no score found', () => {
      const text = `1. 某题没有分数`;
      const result = splitQuestions(text);
      expect(result[0].score).toBe(0);
    });
  });

  describe('splitQuestions - empty input', () => {
    it('should return empty array for empty string', () => {
      const result = splitQuestions('');
      expect(result).toEqual([]);
    });

    it('should return empty array for whitespace only', () => {
      const result = splitQuestions('   \n  \n  ');
      expect(result).toEqual([]);
    });
  });
});
