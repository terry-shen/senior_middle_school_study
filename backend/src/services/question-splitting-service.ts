/**
 * Question Splitting Service
 * Analyzes exam paper content and splits into individual questions
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export type QuestionType = 'single_choice' | 'multiple_choice' | 'fill' | 'essay' | 'unknown';

export interface SplitQuestion {
  questionNumber: number;
  content: string;
  questionType: QuestionType;
  score?: number;
  options?: string[];
  imageUrl?: string;
  correctAnswer?: string;
  analysis?: string;
}

export interface SplitResult {
  success: boolean;
  questions: SplitQuestion[];
  error?: string;
}

/**
 * Detect question type from section header text.
 * Recognizes Chinese section titles like "一、单项选择题" / "二、多项选择题" / "三、填空题" / "四、解答题"
 * @returns QuestionType or null if no section header detected
 */
export function detectSectionType(headerText: string): QuestionType | null {
  if (/单选|单项选择/.test(headerText)) return 'single_choice';
  if (/多选|多项选择/.test(headerText)) return 'multiple_choice';
  if (/填空/.test(headerText)) return 'fill';
  if (/解答|计算|证明|综合/.test(headerText)) return 'essay';
  if (/选择/.test(headerText)) return 'single_choice'; // generic "选择题" → default to single
  return null;
}

/**
 * Scan markdown for section headers and return a map of question start position → section type.
 * Section headers: "一、单项选择题(本题共8小题...)" / "二、多项选择题" / "1. 选择题" etc.
 * Each question inherits the section type of the section it falls in.
 */
export function scanSectionTypes(markdown: string): Map<number, QuestionType> {
  const sectionMap = new Map<number, QuestionType>();
  // Match: line start + Chinese numeral or Arabic numeral + 、 or . + section title
  // Only match Chinese numerals + 、 separator (NOT \d+. which are question numbers)
  // Handle ## markdown heading prefix and 、ideographic comma separator
  const sectionRegex = /(?:^|\n)\s*#{0,3}\s*([一二三四五六七八九十]+)、\s*([^\n]{2,30})/g;
  let match: RegExpExecArray | null;
  while ((match = sectionRegex.exec(markdown)) !== null) {
    const headerText = match[2];
    const sectionType = detectSectionType(headerText);
    if (sectionType) {
      sectionMap.set(match.index, sectionType);
    }
  }
  return sectionMap;
}

/**
 * Get the section type for a question at a given position in the markdown.
 * Returns the section type of the most recent section header before this position,
 * or null if no section header precedes it.
 */
function getSectionTypeAtPosition(markdown: string, position: number, sectionMap: Map<number, QuestionType>): QuestionType | null {
  let result: QuestionType | null = null;
  for (const [sectionPos, sectionType] of sectionMap) {
    if (sectionPos <= position) {
      result = sectionType;
    } else {
      break; // sectionMap is in order of position
    }
  }
  return result;
}

/**
 * Detect question type from content (enhanced rule-based detection)
 * - Detects single_choice vs multiple_choice by option patterns
 * - Detects fill by blank patterns
 * - Falls back to essay only if content is long AND has no option/blank signals
 */
export function detectQuestionType(content: string): QuestionType {
  // Detect options: A. B. C. D. (most common), （A）, A、, A）
  const hasOptions = /(?:^|\n|\s)[A-D][.、）)]\s*\S/.test(content)
    || /（\s*[A-D]\s*[）)]/.test(content)
    || /(?:^|\n|\s)[A-D][.、）)]/m.test(content);
  
  if (hasOptions) {
    // Distinguish single vs multiple choice:
    // Multiple choice clues: "多选" in text, or 5+ options (A-E), or "有两个或两个以上"
    const hasMultipleChoiceSignal = /多选|有两个或两个以上|有两个及以上/.test(content);
    const optionCount = (content.match(/(?:^|\n|\s)[A-E][.、）)]/g) || []).length;
    if (hasMultipleChoiceSignal || optionCount >= 5) {
      return 'multiple_choice';
    }
    return 'single_choice';
  }

  // Fill-in questions have blanks
  const hasBlanks = /_{2,}|（\s{3,}）|\(\s{3,}\)/.test(content);
  if (hasBlanks) {
    return 'fill';
  }

  // No options, no blanks → essay (length check removed: LaTeX formulas inflate length)
  return 'essay';
}

/**
 * Extract score from question content
 */
function extractScore(content: string): number | undefined {
  // Match patterns like "（本题满分12分）" or "（12分）" or "（本小题5分）"
  const scoreMatch = content.match(/（(?:本题|本小题)?(?:满分)?(\d+)分）/);
  if (scoreMatch) {
    return parseInt(scoreMatch[1]);
  }

  // Match patterns like "[12分]" or "（12分）"
  const simpleMatch = content.match(/[（(\[](\d+)分[）)\]]/);
  if (simpleMatch) {
    return parseInt(simpleMatch[1]);
  }

  // Match English patterns like "(5 marks)" or "(10 points)"
  const englishMatch = content.match(/\((\d+)\s*(?:marks?|points?)\)/i);
  if (englishMatch) {
    return parseInt(englishMatch[1]);
  }

  return undefined;
}

/**
 * Extract options from choice question content
 */
export function extractOptions(content: string): string[] | undefined {
  const options: string[] = [];
  
  // Match option patterns like "A. xxx" or "A、xxx" or "（A）xxx"
  const optionPatterns = [
    /A[.、）)]\s*(.+?)(?=B[.、）)]|$)/s,
    /B[.、）)]\s*(.+?)(?=C[.、）)]|$)/s,
    /C[.、）)]\s*(.+?)(?=D[.、）)]|$)/s,
    /D[.、）)]\s*(.+?)(?=[（(（（]|$)/s,
  ];

  for (const pattern of optionPatterns) {
    const match = content.match(pattern);
    if (match) {
      options.push(match[1].trim());
    }
  }

  return options.length === 4 ? options : undefined;
}

/**
 * Strip option lines from question content.
 * Used after extractOptions() to remove the residual option text (e.g. "A. xxx B. yyy ...")
 * from the question stem, so options are stored separately and not duplicated in content.
 *
 * Strategy: find the first occurrence of an option marker (A./A、/A）/（A） etc.)
 * and truncate everything from that point to the end of content (options are always at the tail).
 * Also strips a trailing "（ ）" / "(  )" placeholder that often follows options.
 */
export function stripOptionsFromContent(content: string): string {
  // Match the start of an option block: A. / A、 / A） / （A） / (A) followed by content
  // Require that B. / C. / D. markers also exist later (to avoid false positives like "A. 第一段...")
  const optionBlockRegex = /\n?\s*[（(]?\s*A\s*[.、）)]\s*\S[\s\S]*?\bB\s*[.、）)]\s*\S[\s\S]*?\bC\s*[.、）)]\s*\S[\s\S]*?\bD\s*[.、）)]/i;
  const match = content.match(optionBlockRegex);
  if (match && match.index !== undefined) {
    let cleaned = content.substring(0, match.index).trim();
    // Also strip trailing placeholder like "（ ）" or "(  )" that may follow the question stem
    cleaned = cleaned.replace(/[（(]\s*[）)]\s*$/m, '').trim();
    return cleaned;
  }
  return content;
}

/**
 * Split exam paper content into individual questions
 * Uses regex pattern matching for question boundaries
 */
export function splitQuestions(content: string): SplitResult {
  try {
    const questions: SplitQuestion[] = [];
    
    // Common question number patterns:
    // 1. Arabic numerals: "1." "1、" "1．" "（1）" "一、1."
    // 2. Chinese numerals: "一、" "二、"
    // 3. Combined: "第1题" "第Ⅰ题"

    // Pattern to match question boundaries
    // Matches: "1." "1、" "（1）" "一、" "第1题" etc.
    // Also matches inline (after spaces) for PDF-extracted text without newlines
    const questionPattern = /(?:^|\n|\s{2,})\s*(?:(?:第\s*)?(\d+|[一二三四五六七八九十])[、.．题）)]|（\d+）)/g;
    
    // Find all question start positions
    const matches: { index: number; number: number }[] = [];
    let match;
    
    while ((match = questionPattern.exec(content)) !== null) {
      let questionNum: number;
      
      if (match[1]) {
        // Arabic or Chinese numeral
        const numStr = match[1];
        if (/^\d+$/.test(numStr)) {
          questionNum = parseInt(numStr);
        } else {
          // Convert Chinese numeral to Arabic
          const chineseMap: Record<string, number> = {
            '一': 1, '二': 2, '三': 3, '四': 4, '五': 5,
            '六': 6, '七': 7, '八': 8, '九': 9, '十': 10
          };
          questionNum = chineseMap[numStr] || 0;
        }
      } else if (match[2]) {
        // （数字）format
        questionNum = parseInt(match[2]);
      } else {
        continue;
      }

      matches.push({
        index: match.index,
        number: questionNum
      });
    }

    if (matches.length === 0) {
      return {
        success: false,
        questions: [],
        error: 'No questions found in the content'
      };
    }

    // Extract question content between boundaries
    for (let i = 0; i < matches.length; i++) {
      const startIndex = matches[i].index;
      const endIndex = i < matches.length - 1 ? matches[i + 1].index : content.length;
      
      let questionContent = content.substring(startIndex, endIndex).trim();
      
      // Remove the question number prefix for cleaner content
      const cleanContent = questionContent.replace(/^[一二三四五六七八九十\d]+[、.．题）)\s]*/, '').trim();
      
      const questionType = detectQuestionType(cleanContent);
      const score = extractScore(cleanContent);
      const options = (questionType === 'single_choice' || questionType === 'multiple_choice') ? extractOptions(cleanContent) : undefined;

      questions.push({
        questionNumber: matches[i].number,
        content: cleanContent,
        questionType,
        score,
        options,
      });
    }

    return {
      success: true,
      questions,
    };
  } catch (error: any) {
    return {
      success: false,
      questions: [],
      error: error.message,
    };
  }
}

/**
 * Split questions from MinerU Markdown output
 * MinerU outputs Markdown with LaTeX formulas ($...$/$$...$$), HTML tables, image references
 * Question numbering patterns: "1." "2." or "一、" "二、" or "# 1." "## 1."
 * Also extracts 【答案】 and 【解析】 markers into separate fields
 */
export function splitQuestionsFromMarkdown(markdown: string): SplitResult {
  const questions: SplitQuestion[] = [];

  // Scan section headers for type context
  const sectionMap = scanSectionTypes(markdown);

  // Strategy: Split by 【答案 markers into blocks.
  // Block 0 = content before first answer (Q1 question + options)
  // Block i = answer text + 【解析 + analysis + (possibly next Q content)
  //
  // For each block i (1..N), the answer belongs to question i.
  // The analysis belongs to question i.
  // The "next question content" (if detectable) becomes question i+1.
  //
  // To find the next question content within the analysis:
  // Search for the expected question number string "N." (e.g., "6.") followed by
  // a space or Chinese character, NOT inside LaTeX (not preceded by $/^/_/{/digit)

  const ansMarker = '【答案';
  const anaMarker = '【解析';

  const blocks = markdown.split(ansMarker);

  if (blocks.length <= 1) {
    // No 【答案 markers — try DOCX format (uses ． full-width period and no answer markers)
    return splitQuestionsFromDocx(markdown);
  }

  // Block 0 = Q1 content — find "1. " and keep everything after it
  let block0 = blocks[0].replace(/^#[^\n]*\n/g, '').trim();
  const q1Idx = block0.indexOf('1. ');
  let q1Content: string;
  if (q1Idx >= 0) {
    q1Content = block0.substring(q1Idx + 3).trim();
  } else {
    q1Content = block0;
  }

  if (q1Content.length >= 3) {
    const q1SectionType = getSectionTypeAtPosition(markdown, 0, sectionMap);
    const q1Type = q1SectionType || detectQuestionType(q1Content);
    const q1Opts = extractOptions(q1Content);
    const q1Clean = q1Opts ? stripOptionsFromContent(q1Content) : q1Content;
    questions.push({
      questionNumber: 1,
      content: q1Clean,
      questionType: q1Type,
      options: q1Opts,
      correctAnswer: undefined,
      analysis: undefined,
    });
  }

  // Process blocks 1..N
  for (let i = 1; i < blocks.length; i++) {
    const block = blocks[i];

    // Split at 【解析 marker
    const subParts = block.split(anaMarker);
    const answerPart = subParts[0]; // 】X\n\n
    const analysisAndContent = subParts.length > 1
      ? subParts.slice(1).join(anaMarker).replace(/^[】\s]*/, '')
      : '';

    // Extract answer
    const answer = answerPart.replace(/^[】\s]*/, '').trim();

    // Set answer on question i
    const qi = questions.find(q => q.questionNumber === i);
    if (qi) {
      qi.correctAnswer = answer || undefined;
    } else {
      // Question i doesn't exist yet — create it with empty content
      questions.push({
        questionNumber: i,
        content: '',
        questionType: 'unknown',
        correctAnswer: answer || undefined,
        analysis: undefined,
      });
    }

    // Try to find next question number in the analysis+content text
    // The next question number is i+1 (e.g., block[1] should contain Q2)
    // Use regex: match "N." at start of a LINE (after \n or at string start),
    // followed by space or Chinese char (NOT digit = decimal number)
    // This is much stricter than indexOf — requires line start position
    const nextQNum = i + 1;
    const nextQPattern = new RegExp('(?:^|\\n)\\s*' + nextQNum + '\\.(\\s|[\\u4e00-\\u9fff])');
    const nextQMatch = analysisAndContent.match(nextQPattern);

    let analysis: string;
    let nextQContent: string | undefined;

    if (nextQMatch && nextQMatch.index !== undefined) {
      // Split: analysis is before the match, content is after
      analysis = analysisAndContent.substring(0, nextQMatch.index).trim();
      // Skip past the matched pattern (newline + spaces + N. + separator char)
      let contentStart = nextQMatch.index + nextQMatch[0].length;
      nextQContent = analysisAndContent.substring(contentStart).trim();
    } else {
      // Can't find next question number — all is analysis
      analysis = analysisAndContent.trim();
    }

    // Set analysis on question i
    const qi2 = questions.find(q => q.questionNumber === i);
    if (qi2) {
      qi2.analysis = analysis;
    }

    // Add next question content if found
    if (nextQContent && nextQContent.length >= 3) {
      // Clean: remove section headers and markdown headers
      let cleanedContent = nextQContent
        .replace(/^#[^\n]*\n/g, '')
        .replace(/^[一二三四五六七八九十]+、[^\n]*/g, '')
        .replace(/^\s*\d{1,2}\.\s*/, '')
        .trim();

      if (cleanedContent.length >= 3) {
        // Use section type from markdown context if available
        const contentPos = nextQMatch?.index ?? 0;
        const sectionType = getSectionTypeAtPosition(markdown, contentPos, sectionMap);
        const qType = sectionType || detectQuestionType(cleanedContent);
        const existing = questions.find(q => q.questionNumber === i + 1);
        if (!existing) {
          const opts = extractOptions(cleanedContent);
          const clean = opts ? stripOptionsFromContent(cleanedContent) : cleanedContent;
          questions.push({
            questionNumber: i + 1,
            content: clean,
            questionType: qType,
            options: opts,
            correctAnswer: undefined,
            analysis: undefined,
          });
        } else if (!existing.content) {
          const opts2 = extractOptions(cleanedContent);
          existing.content = opts2 ? stripOptionsFromContent(cleanedContent) : cleanedContent;
          existing.questionType = qType;
          existing.options = opts2;
        }
      }
    }
  }

  // Sort questions by number
  questions.sort((a, b) => a.questionNumber - b.questionNumber);

  // Fill in content for questions that have empty content
  // Use the text between this question's answer marker and the next question's answer marker
  const ansPositions: number[] = [];
  let p = 0;
  while ((p = markdown.indexOf(ansMarker, p)) !== -1) {
    ansPositions.push(p);
    p += ansMarker.length;
  }
  
  for (let qi = 0; qi < questions.length; qi++) {
    if (!questions[qi].content || questions[qi].content.length < 3) {
      // Get content from between this answer marker and the next
      const ansIdx = qi; // question i+1's answer is at ansPositions[i]
      if (ansIdx < ansPositions.length) {
        const start = ansPositions[ansIdx];
        const end = ansIdx + 1 < ansPositions.length ? ansPositions[ansIdx + 1] : markdown.length;
        let rawContent = markdown.substring(start, end);
        // Strip 【答案 and 【解析 markers and answer text
        const anaIdx = rawContent.indexOf(anaMarker);
        if (anaIdx >= 0) {
          // Content is after analysis marker — use the analysis text as content
          rawContent = rawContent.substring(anaIdx + anaMarker.length).replace(/^[】\s]*/, '').trim();
        } else {
          rawContent = rawContent.replace(/^【答案[】\s]*/, '').trim();
        }
        // Try to find the question number in this content
        const qNum = questions[qi].questionNumber;
        const numStr = qNum + '.';
        const numIdx = rawContent.indexOf(numStr);
        if (numIdx >= 0) {
          // Check if followed by space or Chinese
          const afterChar = rawContent[numIdx + numStr.length];
          if (afterChar === ' ' || (afterChar && afterChar.charCodeAt(0) >= 0x4e00)) {
            rawContent = rawContent.substring(numIdx + numStr.length);
            if (rawContent[0] === ' ') rawContent = rawContent.substring(1);
          }
        }
        // Clean up
        rawContent = rawContent
          .replace(/^[一二三四五六七八九十]+、[^\n]*/g, '')
          .replace(/^#[^\n]*\n/g, '')
          .trim();
        
        if (rawContent.length >= 3) {
          questions[qi].content = rawContent;
          const fillPos = ansIdx < ansPositions.length ? ansPositions[ansIdx] : 0;
          const fillSectionType = getSectionTypeAtPosition(markdown, fillPos, sectionMap);
          questions[qi].questionType = fillSectionType || detectQuestionType(rawContent);
          questions[qi].options = extractOptions(rawContent);
        }
      }
    }
  }

  if (questions.length === 0) {
    return splitQuestionsByRegex(markdown);
  }

  return { success: true, questions };
}

// Split questions from DOCX format (no 【答案 markers, uses ． full-width period)
function splitQuestionsFromDocx(markdown: string): SplitResult {
  const questions: SplitQuestion[] = [];
  const sectionMap = scanSectionTypes(markdown);

  // DOCX format uses full-width period ． (U+FF0E) for question numbers
  // Pattern: "N．" or "N." at line start, followed by question text
  const processedMd = markdown.replace(/^#[^\n]*\n/g, '');

  // Find all question numbers (1-20) followed by ． or .
  const questionRegex = /(?:^|\n)\s*(\d{1,2})[．.]\s*/g;
  const matches: { num: number; index: number }[] = [];
  let match: RegExpExecArray | null;

  while ((match = questionRegex.exec(processedMd)) !== null) {
    const num = parseInt(match[1]);
    if (num >= 1 && num <= 30) {
      matches.push({ num, index: match.index });
    }
  }

  // Also try Chinese section headers as fallback
  if (matches.length === 0) {
    const chinRegex = /(?:^|\n)\s*([一二三四五六七八九十]+)、/g;
    while ((match = chinRegex.exec(processedMd)) !== null) {
      matches.push({ num: matches.length + 1, index: match.index });
    }
  }

  // Split content by matched positions
  for (let i = 0; i < matches.length; i++) {
    const startIdx = matches[i].index;
    const endIdx = i + 1 < matches.length ? matches[i + 1].index : processedMd.length;
    let content = processedMd.substring(startIdx, endIdx).trim();

    // Remove the leading number prefix
    content = content.replace(/^\s*\d{1,2}[．.]\s*/, '');

    // Remove section headers from content
    content = content.replace(/^[一二三四五六七八九十]+、[^\n]*\n/g, '');

    if (content.length < 5) continue;

    // Extract options if present (A． B． C． D． format), then strip from content
    const extractedOpts = extractOptions(content);
    const opts: string[] | undefined = (extractedOpts && extractedOpts.length > 0) ? extractedOpts : undefined;
    const cleanContent = opts ? stripOptionsFromContent(content) : content;

    const sectionType = getSectionTypeAtPosition(markdown, startIdx, sectionMap);
    questions.push({
      questionNumber: matches[i].num,
      content: cleanContent,
      questionType: sectionType || detectQuestionType(content),
      options: opts,
    });
  }

  if (questions.length === 0) {
    return splitQuestionsByRegex(markdown);
  }

  return { success: true, questions };
}

// Old regex-based split, kept as fallback
function splitQuestionsByRegex(markdown: string): SplitResult {
  const questions: SplitQuestion[] = [];
  const processedMd = markdown.replace(/[。）\]\s]+(\d{1,2}\.\s)/g, '\n$1');
  const sectionMap = scanSectionTypes(markdown);
  const questionRegex = /(?:^|\n)\s*(\d{1,2})\.\s*(?![\d.])/g;

  let matches: { num: number; index: number }[] = [];
  let match: RegExpExecArray | null;

  while ((match = questionRegex.exec(processedMd)) !== null) {
    const num = parseInt(match[1]);
    if (num >= 1 && num <= 50) {
      matches.push({ num, index: match.index });
    }
  }

  // If no numbered matches, try Chinese numbering
  if (matches.length === 0) {
    const chinRegex = /(?:^|\n)\s*([一二三四五六七八九十]+)、/g;
    while ((match = chinRegex.exec(markdown)) !== null) {
      matches.push({ num: matches.length + 1, index: match.index });
    }
  }

  // Split content by matched positions
  for (let i = 0; i < matches.length; i++) {
    const startIdx = matches[i].index;
    const endIdx = i + 1 < matches.length ? matches[i + 1].index : processedMd.length;
    let rawContent = processedMd.substring(startIdx, endIdx).trim();

    if (rawContent.length < 5) continue; // Skip fragments

    // Remove the leading number prefix (e.g., "12. " or "十二、")
    rawContent = rawContent.replace(/^\s*\d{1,2}\.\s*/, '').replace(/^\s*[一二三四五六七八九十]+、\s*/, '');

    // Split content by 【答案】 and 【解析】 markers using indexOf for reliability
    let content = rawContent;
    let correctAnswer: string | undefined;
    let analysis: string | undefined;

    const ansIdx = rawContent.indexOf('【答案');
    const anaIdx = rawContent.indexOf('【解析');

    if (ansIdx >= 0 && anaIdx >= 0 && anaIdx > ansIdx) {
      // Has both answer and analysis (answer comes first)
      content = rawContent.substring(0, ansIdx).trim();
      const ansRaw = rawContent.substring(ansIdx, anaIdx);
      // Extract answer text after the marker, skipping the marker itself and any 】
      correctAnswer = ansRaw.replace(/^【答案[】\s]*/, '').trim();
      analysis = rawContent.substring(anaIdx).replace(/^【解析[】\s]*/, '').trim();
    } else if (ansIdx >= 0) {
      // Has only answer
      content = rawContent.substring(0, ansIdx).trim();
      correctAnswer = rawContent.substring(ansIdx).replace(/^【答案[】\s]*/, '').trim();
    } else if (anaIdx >= 0) {
      // Has only analysis
      content = rawContent.substring(0, anaIdx).trim();
      analysis = rawContent.substring(anaIdx).replace(/^【解析[】\s]*/, '').trim();
    }

    // Extract options (A. B. C. D. pattern, preserving LaTeX)
    const options: string[] = [];
    const optionRegex = /(?:^|\n)\s*([A-D])[.、)]\s*(.+?)(?=\n\s*[A-D][.、)]|$)/g;
    let optMatch: RegExpExecArray | null;
    while ((optMatch = optionRegex.exec(content)) !== null) {
      options.push(`${optMatch[1]}. ${optMatch[2].trim()}`);
    }

    questions.push({
      questionNumber: matches[i].num,
      content,
      questionType: getSectionTypeAtPosition(markdown, matches[i].index, sectionMap) || detectQuestionType(content),
      options: options.length > 0 ? options : undefined,
      correctAnswer,
      analysis,
    });
  }

  // Sort by question number and renumber sequentially
  questions.sort((a, b) => a.questionNumber - b.questionNumber);
  questions.forEach((q, i) => { q.questionNumber = i + 1; });

  return { success: true, questions };
}

/**
 * Create question records in database from split results
 */
async function createQuestionsInDb(paperId: number, questions: SplitQuestion[]): Promise<SplitResult> {
  const createdQuestions: SplitQuestion[] = [];

  for (const q of questions) {
    // Strip option text from content if options were extracted separately
    const cleanContent = q.options ? stripOptionsFromContent(q.content) : q.content;
    const question = await prisma.question.create({
      data: {
        paperId,
        questionNumber: q.questionNumber,
        content: cleanContent,
        questionType: q.questionType,
        score: q.score,
        options: q.options ? JSON.stringify(q.options) : null,
        imageUrl: q.imageUrl || null,
        answer: q.correctAnswer || null,
        analysis: q.analysis || null,
        aiAnalyzed: q.correctAnswer ? true : false,
      },
    });

    createdQuestions.push({
      questionNumber: question.questionNumber,
      content: question.content,
      questionType: question.questionType as any,
      score: question.score || undefined,
      options: question.options ? JSON.parse(question.options) : undefined,
      imageUrl: question.imageUrl || undefined,
      correctAnswer: question.answer || undefined,
      analysis: question.analysis || undefined,
    });
  }

  // Update paper status
  await prisma.examPaper.update({
    where: { id: paperId },
    data: { status: 'analyzed' },
  });

  return { success: true, questions: createdQuestions };
}

/**
 * Split questions from an exam paper record
 * Updates the paper status and creates question records
 */
export async function splitQuestionsFromPaper(paperId: number): Promise<SplitResult> {
  try {
    // Get the paper content
    const paper = await prisma.examPaper.findUnique({
      where: { id: paperId },
    });

    if (!paper) {
      return {
        success: false,
        questions: [],
        error: 'Paper not found',
      };
    }

    // If paper has parsedMarkdown (from MinerU), use it for splitting
    // MinerU outputs Markdown with LaTeX formulas preserved
    if (paper.parsedMarkdown) {
      console.log('[question-splitting] Using MinerU parsedMarkdown for splitting');
      const result = splitQuestionsFromMarkdown(paper.parsedMarkdown);
      if (result.success && result.questions.length > 0) {
        return await createQuestionsInDb(paperId, result.questions);
      }
      // Fall through to other methods if markdown splitting failed
    }

    if (!paper.rawContent) {
      return {
        success: false,
        questions: [],
        error: 'Paper has no content to split',
      };
    }

    // Check if rawContent is structured MCQ items from mcq-extractor
    let structuredItems: any[] | null = null;
    let textContent = paper.rawContent;

    try {
      const parsed = JSON.parse(paper.rawContent);
      if (parsed && parsed.__type === 'mcq_extractor' && Array.isArray(parsed.items)) {
        structuredItems = parsed.items;
        textContent = parsed.rawText || paper.rawContent;
      }
    } catch {
      // Not JSON or not mcq_extractor format - use as plain text
    }

    let result: SplitResult;

    if (structuredItems && structuredItems.length > 0) {
      // Use structured MCQ items directly (skip regex splitting)
      result = {
        success: true,
        questions: structuredItems.map((item: any, index: number) => ({
          questionNumber: item.question_number || index + 1,
          content: item.question || '',
          questionType: detectQuestionType(item.question || ''),
          score: undefined,
          options: item.options ? Object.values(item.options) : undefined,
          imageUrl: '',
          correctAnswer: item.correct_answer,
        })),
      };
    } else {
      // Split questions using regex
      result = splitQuestions(textContent);
    }

    if (!result.success) {
      return result;
    }

    // Create question records in database
    const createdQuestions: SplitQuestion[] = [];

    for (const q of result.questions) {
      const cleanContent = q.options ? stripOptionsFromContent(q.content) : q.content;
      const question = await prisma.question.create({
        data: {
          paperId,
          questionNumber: q.questionNumber,
          content: cleanContent,
          questionType: q.questionType,
          score: q.score,
          options: q.options ? JSON.stringify(q.options) : null,
          imageUrl: q.imageUrl,
          answer: q.correctAnswer || null,
          analysis: q.analysis || null,
          aiAnalyzed: q.correctAnswer ? true : false,
        },
      });

      createdQuestions.push({
        questionNumber: question.questionNumber,
        content: question.content,
        questionType: question.questionType as any,
        score: question.score || undefined,
        options: question.options ? JSON.parse(question.options) : undefined,
        imageUrl: question.imageUrl || undefined,
        correctAnswer: question.answer || undefined,
        analysis: question.analysis || undefined,
      });
    }

    // Update paper status to 'analyzed'
    await prisma.examPaper.update({
      where: { id: paperId },
      data: { status: 'analyzed' },
    });

    return {
      success: true,
      questions: createdQuestions,
    };
  } catch (error: any) {
    return {
      success: false,
      questions: [],
      error: error.message,
    };
  }
}

// ============================================================
// TAG-BASED SPLITTING (new approach)
// Uses HTML comment tags <!--QN_START-->/<!--QN_END--> to mark
// question boundaries. Auto-tags from heuristic, then splits by tag pairing.
// ============================================================

/**
 * Auto-tag questions in Markdown by inserting HTML comment tags.
 * Searches for question number patterns at line start (e.g., "1.题目", "2.已知")
 * and 【答案】 markers to determine question boundaries.
 * Tags: <!--QN_START--> at question begin, <!--QN_END--> at question end (before next Q start)
 */
export function autoTagQuestions(markdown: string): string {
  // Check if already tagged
  if (markdown.includes('<!--Q') && /<!--Q\d+_START-->/.test(markdown)) {
    return markdown; // Already tagged, no re-tagging
  }

  // Remove markdown headers (# title) and section headers (一、选择题...)
  // BUT keep header lines that carry a 【编号】 question tag (e.g. "## 【131】(2018·天津...)")
  let cleanMd = markdown.replace(/^#{1,6}\s+(?!【\s*\d)[^\n]*\n/gm, '');

  // === Question-bank book mode (题库书) ===
  // Format: lines starting with 【编号】 e.g. "【116】(2013·重庆·理·3·★★)已知..."
  // Question numbers are typically > 30 and continuous across the whole book.
  // Detect this BEFORE the numbered-list mode below, otherwise lines like
  // "1." in solution-summary paragraphs get mis-tagged as questions.
  const bookRegex = /^\s*#{0,6}\s*【\s*(\d{1,4})\s*】/gm;
  const bookStarts: { num: number; pos: number }[] = [];
  let bm: RegExpExecArray | null;
  while ((bm = bookRegex.exec(cleanMd)) !== null) {
    const bNum = parseInt(bm[1]);
    if (bNum >= 1) {
      // Position the START tag right before the 【 character (after any heading markers)
      bookStarts.push({ num: bNum, pos: bm.index + bm[0].indexOf('【') });
    }
  }
  if (bookStarts.length >= 2) {
    // Deduplicate: keep first occurrence of each question number
    const bookSeen = new Set<number>();
    const uniqueBookStarts = bookStarts.filter(s => {
      if (bookSeen.has(s.num)) return false;
      bookSeen.add(s.num);
      return true;
    });

    const insertions: { pos: number; tag: string; isStart: boolean }[] = [];
    for (let i = 0; i < uniqueBookStarts.length; i++) {
      const qNum = uniqueBookStarts[i].num;
      const startPos = uniqueBookStarts[i].pos;
      insertions.push({ pos: startPos, tag: `<!--Q${qNum}_START-->`, isStart: true });

      let endPos = cleanMd.length;
      if (i < uniqueBookStarts.length - 1) {
        endPos = uniqueBookStarts[i + 1].pos;
      }
      insertions.push({ pos: endPos, tag: `<!--Q${qNum}_END-->`, isStart: false });
    }
    insertions.sort((a, b) => {
      if (b.pos !== a.pos) return b.pos - a.pos;
      if (a.isStart && !b.isStart) return -1;
      if (!a.isStart && b.isStart) return 1;
      return 0;
    });

    let taggedMarkdown = cleanMd;
    for (const ins of insertions) {
      taggedMarkdown = taggedMarkdown.substring(0, ins.pos) + ins.tag + taggedMarkdown.substring(ins.pos);
    }
    return taggedMarkdown;
  }

  // Preprocess: add newline before question numbers that follow section headers, Chinese periods, or answer letters
  // e.g., "...共40分。)1. $(1-3i)^2=$" → "...共40分。)\n1. $(1-3i)^2=$"
  // e.g., "故选B5.棱台" → "故选B\n5.棱台"
  // Question number can be followed by space OR Chinese character (MinerU format)
  cleanMd = cleanMd.replace(/([。)）])(\d{1,2})[．.](\s|[\u4e00-\u9fff])/g, '$1\n$2.$3');
  cleanMd = cleanMd.replace(/([A-D])(\d{1,2})[．.](\s|[\u4e00-\u9fff])/g, '$1\n$2.$3');
  cleanMd = cleanMd.replace(/。(\d{1,2})[．.](\s|[\u4e00-\u9fff])/g, '。\n$1.$2');

  // Find all question number patterns at line start: "N. " or "N．" (full-width)
  // followed by a space or Chinese character (NOT another digit = decimal)
  const qStartRegex = /(?:^|\n)\s*(\d{1,2})[．.](\s|[\u4e00-\u9fff])(?![\d.])/g;
  const qStarts: { num: number; pos: number }[] = [];
  let m: RegExpExecArray | null;

  while ((m = qStartRegex.exec(cleanMd)) !== null) {
    const qNum = parseInt(m[1]);
    if (qNum >= 1 && qNum <= 30) {
      // Position at the START of the question-number digit itself, so the START tag
      // is inserted BEFORE "N. " (the number belongs to THIS question) and the END tag
      // of the previous question lands BEFORE "N+1. " (never swallowing the next number).
      const digitStart = m.index + m[0].indexOf(m[1]);
      qStarts.push({ num: qNum, pos: digitStart });
    }
  }

  if (qStarts.length === 0) {
    return markdown; // Can't detect any questions
  }

  // Deduplicate: keep first occurrence of each question number
  const seen = new Set<number>();
  const uniqueStarts = qStarts.filter(s => {
    if (seen.has(s.num)) return false;
    seen.add(s.num);
    return true;
  });

  // Create insertions: START tag before each question, END tag before next question's START
  const insertions: { pos: number; tag: string; isStart: boolean }[] = [];

  for (let i = 0; i < uniqueStarts.length; i++) {
    const qNum = uniqueStarts[i].num;
    const startPos = uniqueStarts[i].pos;
    insertions.push({ pos: startPos, tag: `<!--Q${qNum}_START-->`, isStart: true });

    // END tag is at the start of the next question, or end of markdown
    let endPos = cleanMd.length;
    if (i < uniqueStarts.length - 1) {
      endPos = uniqueStarts[i + 1].pos;
    }
    insertions.push({ pos: endPos, tag: `<!--Q${qNum}_END-->`, isStart: false });
  }

  // Sort by position descending. For same position: START tags first (inserted first, appear later in string)
  // This ensures correct order: Q1_END Q2_START (END inserted after START at same position, appears before)
  insertions.sort((a, b) => {
    if (b.pos !== a.pos) return b.pos - a.pos;
    // Same position: START tags first in insertion order (they appear after END in final string)
    if (a.isStart && !b.isStart) return -1; // a (START) first → appears after END
    if (!a.isStart && b.isStart) return 1;  // b (START) first → appears after END
    return 0;
  });

  // Insert tags into cleanMd
  let taggedMarkdown = cleanMd;
  for (const ins of insertions) {
    taggedMarkdown = taggedMarkdown.substring(0, ins.pos) + ins.tag + taggedMarkdown.substring(ins.pos);
  }

  return taggedMarkdown;
}

/**
 * Split Markdown by tag pairing: <!--QN_START-->...<!--QN_END-->
 * Extracts content between each tag pair, then finds answer/analysis markers.
 * Falls back to splitQuestionsFromMarkdown() if no tags found.
 */
export function splitQuestionsByTags(markdown: string): SplitResult {
  // Check if tags exist
  const hasTags = /<!--Q\d+_START-->/.test(markdown);
  if (!hasTags) {
    // No tags — fall back to old regex splitting
    return splitQuestionsFromMarkdown(markdown);
  }

  const questions: SplitQuestion[] = [];
  const sectionMap = scanSectionTypes(markdown);

  // Extract all tag pairs: <!--QN_START-->(content)<!--QN_END-->
  const tagRegex = /<!--Q(\d+)_START-->([\s\S]*?)<!--Q\1_END-->/g;
  let match: RegExpExecArray | null;

  while ((match = tagRegex.exec(markdown)) !== null) {
    const qNum = parseInt(match[1]);
    let content = match[2].trim();

    // Boundary regularization. Older auto-tagging placed the END tag AFTER the next
    // question's number (e.g. "...9\n\n2.<!--Q1_END-->"), swallowing that number into
    // this block. If the block ends with a lone "N." line, it is the next question's
    // number — drop it (the user may also see the number moved into the current
    // question via the START position fix in autoTagQuestions).
    content = content.replace(/\n\s*\d{1,2}[.．]\s*$/, '').trim();

    const contentPos = match.index;

    // Extract answer from content (look for 【答案 marker)
    let answer: string | undefined;
    const ansIdx = content.indexOf('【答案');
    if (ansIdx >= 0) {
      const afterAns = content.substring(ansIdx + 4); // Skip 【答案
      // Answer is up to 【解析 or end of content
      const anaIdx = afterAns.indexOf('【解析');
      answer = (anaIdx >= 0 ? afterAns.substring(0, anaIdx) : afterAns)
        .replace(/^】\s*/, '').trim();
    }

    // Extract analysis from content (look for 【解析 marker)
    let analysis: string | undefined;
    const anaIdx2 = content.indexOf('【解析');
    if (anaIdx2 >= 0) {
      analysis = content.substring(anaIdx2 + 4) // Skip 【解析
        .replace(/^】\s*/, '').trim();
    }

    // Remove answer and analysis markers from content (they go in separate fields)
    if (ansIdx >= 0) {
      content = content.substring(0, ansIdx).trim();
    } else if (anaIdx2 >= 0) {
      content = content.substring(0, anaIdx2).trim();
    }

    // Extract options, then strip option text from content to avoid duplication
    const extractedOpts = extractOptions(content);
    const cleanContent = extractedOpts ? stripOptionsFromContent(content) : content;

    questions.push({
      questionNumber: qNum,
      content: cleanContent,
      questionType: getSectionTypeAtPosition(markdown, contentPos, sectionMap) || detectQuestionType(content),
      options: extractedOpts,
      correctAnswer: answer,
      analysis,
    });
  }

  // Handle unpaired tags: <!--QN_START--> without matching <!--QN_END-->
  const unpairedRegex = /<!--Q(\d+)_START-->((?:(?!<!--Q\d+_END-->)[\s\S])*)/g;
  while ((match = unpairedRegex.exec(markdown)) !== null) {
    const qNum = parseInt(match[1]);
    // Check if this question was already captured by paired regex
    if (questions.some(q => q.questionNumber === qNum)) {
      continue;
    }
    // This is an unpaired tag — take content from start tag to next start tag or end of string
    let content = match[2].trim();
    // Remove any trailing <!--QN_END--> that might belong to another question
    content = content.replace(/<!--Q\d+_END-->/g, '').trim();

    if (content.length > 0) {
      console.warn(`[splitQuestionsByTags] Unpaired tag for Q${qNum}, using content to next tag`);
      const unpairedPos = match.index;
      const unpairedOpts = extractOptions(content);
      const unpairedClean = unpairedOpts ? stripOptionsFromContent(content) : content;
      questions.push({
        questionNumber: qNum,
        content: unpairedClean,
        questionType: getSectionTypeAtPosition(markdown, unpairedPos, sectionMap) || detectQuestionType(content),
        options: unpairedOpts,
      });
    }
  }

  // Sort by question number
  questions.sort((a, b) => a.questionNumber - b.questionNumber);

  return {
    success: true,
    questions,
  };
}

/**
 * Split questions by tags and save to database (used by confirm-import endpoint)
 * Updates existing questions by sourcePaperId + sourceQuestionNumber match.
 * Optional `overrides` map applies AI cleaning results (questionNumber -> cleaned content)
 * before persisting. Only content/options are overridden; answer/analysis/type come from the split.
 */
export async function splitQuestionsByTagsAndSave(
  paperId: number,
  markdown: string,
  overrides?: Map<number, { content: string; options?: string[] }>,
  userEdited?: SplitQuestion[]
): Promise<{ success: boolean; created: number; updated: number; error?: string }> {
  let questions: SplitQuestion[];
  if (userEdited && userEdited.length > 0) {
    // Front-end calibrated data is authoritative (user may have edited content/options/answer/analysis)
    questions = userEdited;
  } else {
    const splitResult = splitQuestionsByTags(markdown);
    if (!splitResult.success) {
      return { success: false, created: 0, updated: 0, error: splitResult.error };
    }
    questions = splitResult.questions;
  }

  let created = 0;
  let updated = 0;

  for (const q of questions) {
    // Apply accepted AI cleaning proposal (if any) — only when not user-edited
    const override = overrides?.get(q.questionNumber);
    const content = (userEdited || !override || !override.content) ? q.content : override.content;
    const options = (userEdited || !override || !override.content)
      ? q.options
      : (override.options ?? extractOptions(override.content));

    // Check if question with same sourcePaperId + sourceQuestionNumber exists
    const existing = await prisma.question.findFirst({
      where: {
        paperId: paperId,
        questionNumber: q.questionNumber,
      },
    });

    if (existing) {
      // Update existing question
      const cleanContent = options ? stripOptionsFromContent(content) : content;
      await prisma.question.update({
        where: { id: existing.id },
        data: {
          content: cleanContent,
          questionType: q.questionType,
          options: options ? JSON.stringify(options) : null,
          answer: q.correctAnswer || null,
          analysis: q.analysis || null,
          imageUrl: q.imageUrl || null,
          score: q.score || null,
        },
      });
      updated++;
    } else {
      // Create new question
      const cleanContent = options ? stripOptionsFromContent(content) : content;
      await prisma.question.create({
        data: {
          paperId,
          questionNumber: q.questionNumber,
          content: cleanContent,
          questionType: q.questionType,
          options: options ? JSON.stringify(options) : null,
          answer: q.correctAnswer || null,
          analysis: q.analysis || null,
          imageUrl: q.imageUrl || null,
          score: q.score || null,
          aiAnalyzed: false,
        },
      });
      created++;
    }
  }

  // Update paper status
  await prisma.examPaper.update({
    where: { id: paperId },
    data: { status: 'completed' },
  });

  return { success: true, created, updated };
}